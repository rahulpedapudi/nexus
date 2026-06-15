package ui

import (
	"fmt"
	"strings"
	"time"

	"nexus-tui/api"
	"nexus-tui/styles"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type LogoutMsg struct{}

type TuiCommand struct {
	Name        string
	Description string
	Action      func(m *ChatModel) tea.Cmd
}

var tuiCommands = []TuiCommand{
	{
		Name:        "/new",
		Description: "Start a new conversation",
		Action: func(m *ChatModel) tea.Cmd {
			m.convID = ""
			m.activeIdx = -1
			m.messages = []api.Message{}
			m.renderMessages()
			return nil
		},
	},
	{
		Name:        "/clear",
		Description: "Clear local screen messages",
		Action: func(m *ChatModel) tea.Cmd {
			m.messages = []api.Message{}
			m.renderMessages()
			return nil
		},
	},
	{
		Name:        "/sidebar",
		Description: "Toggle conversation sidebar",
		Action: func(m *ChatModel) tea.Cmd {
			m.hideSidebar = !m.hideSidebar
			return func() tea.Msg {
				return tea.WindowSizeMsg{Width: m.width, Height: m.height}
			}
		},
	},
	{
		Name:        "/logout",
		Description: "Log out of current user account",
		Action: func(m *ChatModel) tea.Cmd {
			return func() tea.Msg {
				return LogoutMsg{}
			}
		},
	},
	{
		Name:        "/quit",
		Description: "Exit the application",
		Action: func(m *ChatModel) tea.Cmd {
			return tea.Quit
		},
	},
}

type ChatModel struct {
	client             *api.Client
	convID             string
	messages           []api.Message
	conversations      []api.Conversation
	selectedIdx        int
	activeIdx          int
	focusSidebar       bool
	viewport           viewport.Model
	input              textinput.Model
	spinner            spinner.Model
	isLoading          bool
	connected          bool
	width              int
	height             int
	commandIdx         int
	baseViewportHeight int
	hideSidebar        bool
	username           string
	pendingMsg         string
}

func NewChatModel(username string, client *api.Client) ChatModel {
	ti := textinput.New()
	ti.Placeholder = "type a message or '/' for commands..."
	ti.Focus()
	ti.CharLimit = 256
	ti.Width = 40

	vp := viewport.New(0, 0)

	s := spinner.New()
	s.Spinner = spinner.Dot

	return ChatModel{
		client:       client,
		input:        ti,
		viewport:     vp,
		spinner:      s,
		connected:    true,
		focusSidebar: false,
		username:     username,
		activeIdx:    -1, // Start at home screen by default
	}
}

func (m *ChatModel) isCommandMode() bool {
	return strings.HasPrefix(m.input.Value(), "/")
}

func (m *ChatModel) getMatchedCommands() []TuiCommand {
	val := m.input.Value()
	var matched []TuiCommand
	for _, cmd := range tuiCommands {
		if strings.HasPrefix(cmd.Name, val) {
			matched = append(matched, cmd)
		}
	}
	return matched
}

func (m *ChatModel) updateViewportHeight() {
	height := m.baseViewportHeight
	if m.isCommandMode() {
		matched := m.getMatchedCommands()
		if len(matched) > 0 {
			height -= (len(matched) + 3)
		}
	}
	if height < 3 {
		height = 3
	}
	m.viewport.Height = height
}

func (m ChatModel) Init() tea.Cmd {
	return tea.Batch(
		textinput.Blink,
		m.spinner.Tick,
		fetchConvListCmd(m.client),
	)
}

func (m ChatModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	if m.isLoading {
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		m.baseViewportHeight = msg.Height - 7
		m.updateViewportHeight()

		sidebarWidth := 25
		if msg.Width < 80 || m.hideSidebar {
			sidebarWidth = 0
		}

		m.viewport.Width = msg.Width - sidebarWidth - 6
		m.input.Width = msg.Width - sidebarWidth - 8

		m.renderMessages()

	case tea.KeyMsg:
		if msg.Type == tea.KeyTab {
			if !m.isCommandMode() {
				m.focusSidebar = !m.focusSidebar
				if m.focusSidebar {
					m.input.Blur()
				} else {
					m.input.Focus()
				}
				return m, nil
			}
		}

		if msg.Type == tea.KeyCtrlN {
			m.convID = ""
			m.activeIdx = -1
			m.messages = []api.Message{}
			m.renderMessages()
			m.focusSidebar = false
			m.input.Focus()
			return m, nil
		}

		if msg.String() == "ctrl+l" {
			m.messages = []api.Message{}
			m.renderMessages()
			return m, nil
		}

		if m.focusSidebar {
			switch msg.String() {
			case "up", "k":
				if m.selectedIdx > 0 {
					m.selectedIdx--
				}
			case "down", "j":
				if m.selectedIdx < len(m.conversations)-1 {
					m.selectedIdx++
				}
			case "enter":
				if len(m.conversations) > 0 {
					m.activeIdx = m.selectedIdx
					m.convID = m.conversations[m.activeIdx].ID
					m.isLoading = true
					m.messages = []api.Message{}
					m.renderMessages()
					cmds = append(cmds, fetchMessagesCmd(m.client, m.convID))
				}
			}
		} else {
			if !m.isLoading {
				if m.isCommandMode() {
					matched := m.getMatchedCommands()
					switch msg.Type {
					case tea.KeyUp:
						if len(matched) > 0 {
							m.commandIdx = (m.commandIdx - 1 + len(matched)) % len(matched)
						}
						return m, nil
					case tea.KeyDown:
						if len(matched) > 0 {
							m.commandIdx = (m.commandIdx + 1) % len(matched)
						}
						return m, nil
					case tea.KeyEnter:
						if len(matched) > 0 && m.commandIdx >= 0 && m.commandIdx < len(matched) {
							cmdToRun := matched[m.commandIdx]
							m.input.Reset()
							m.commandIdx = 0
							m.updateViewportHeight()
							actionCmd := cmdToRun.Action(&m)
							if actionCmd != nil {
								cmds = append(cmds, actionCmd)
							}
						} else {
							m.input.Reset()
							m.commandIdx = 0
							m.updateViewportHeight()
						}
						return m, tea.Batch(cmds...)
					case tea.KeyEsc:
						m.input.Reset()
						m.commandIdx = 0
						m.updateViewportHeight()
						return m, nil
					}
				} else {
					switch msg.Type {
					case tea.KeyEnter:
						val := strings.TrimSpace(m.input.Value())
						if val != "" {
							m.input.Reset()
							m.isLoading = true

							if m.convID == "" {
								m.pendingMsg = val
								cmds = append(cmds, createConvCmd(m.client))
							} else {
								m.messages = append(m.messages, api.Message{
									Content:   val,
									Role:      "user",
									CreatedAt: time.Now().Format(time.RFC3339),
								})
								m.renderMessages()
								m.viewport.GotoBottom()

								cmds = append(cmds, sendMessageCmd(m.client, m.convID, val))
							}
						}
					case tea.KeyEsc:
						m.input.Reset()
					}
				}
			}
		}

	case convListFetchedMsg:
		if msg.err != nil {
			m.connected = false
		} else {
			m.connected = true
			m.conversations = msg.conversations

			// Always start at home welcome screen when logged in
			m.activeIdx = -1
			m.selectedIdx = 0
			m.convID = ""
			m.messages = []api.Message{}
			m.renderMessages()
		}

	case convCreatedMsg:
		m.isLoading = false
		if msg.err != nil {
			m.connected = false
			m.pendingMsg = ""
		} else {
			m.connected = true
			m.conversations = append(m.conversations, *msg.conv)
			m.activeIdx = len(m.conversations) - 1
			m.selectedIdx = m.activeIdx
			m.convID = msg.conv.ID
			m.messages = []api.Message{}

			if m.pendingMsg != "" {
				m.isLoading = true
				m.messages = append(m.messages, api.Message{
					Content:   m.pendingMsg,
					Role:      "user",
					CreatedAt: time.Now().Format(time.RFC3339),
				})
				m.renderMessages()
				m.viewport.GotoBottom()
				cmds = append(cmds, sendMessageCmd(m.client, m.convID, m.pendingMsg))
				m.pendingMsg = ""
			} else {
				m.renderMessages()
				m.viewport.GotoBottom()
			}
			m.focusSidebar = false
			m.input.Focus()
		}

	case messagesFetchedMsg:
		m.isLoading = false
		if msg.err != nil {
			m.connected = false
		} else {
			m.connected = true
			m.messages = msg.messages
			m.renderMessages()
			m.viewport.GotoBottom()
		}

	case messageSentMsg:
		m.isLoading = false
		if msg.err != nil {
			m.connected = false
		} else {
			m.connected = true
			m.messages = append(m.messages, *msg.msg)
			m.renderMessages()
			m.viewport.GotoBottom()
		}
	}

	if !m.focusSidebar && !m.isLoading {
		var cmd tea.Cmd
		oldVal := m.input.Value()
		m.input, cmd = m.input.Update(msg)
		cmds = append(cmds, cmd)

		if m.input.Value() != oldVal {
			m.commandIdx = 0
			m.updateViewportHeight()
		}
	}

	var cmd tea.Cmd
	passToViewport := true
	if m.focusSidebar {
		switch msg.(type) {
		case tea.KeyMsg, tea.MouseMsg:
			passToViewport = false
		}
	}
	if passToViewport {
		m.viewport, cmd = m.viewport.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m *ChatModel) renderMessages() {
	if len(m.messages) == 0 {
		w := m.viewport.Width
		if w <= 0 {
			w = 60
		}

		greeting := "there!"
		if m.username != "" {
			greeting = m.username + "!"
		}

		logo := lipgloss.NewStyle().
			Foreground(styles.PrimaryColor).
			Bold(true).
			Render(`
 _   _                     
| \ | | ___  __  _   _ __ __ 
|  \| |/ _ \ \ \/ / | | / __|
| |\  |  __/  >  <| |_| \__ \
|_| \_|\___| /_/\_\__,_|___/
`)

		welcome := fmt.Sprintf(
			"%s\n\n"+
				"Hello, %s\n\n"+
				"Nexus is your privacy-first, secure personal AI assistant.\n"+
				"All chats are processed securely on your server.\n\n"+
				"Quick Shortcuts:\n"+
				"  %-12s send a message to the bot\n"+
				"  %-12s toggle focus to conversation sidebar\n"+
				"  %-12s open commands autocomplete menu\n"+
				"  %-12s start a new clean conversation\n\n"+
				"Type a message below to start chatting!",
			logo,
			greeting,
			"[Enter]",
			"[Tab]",
			"[/]",
			"[Ctrl+N]",
		)

		welcomeView := lipgloss.NewStyle().
			Padding(1, 2).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(styles.BorderColor).
			Width(w - 6).
			Render(welcome)

		m.viewport.SetContent(welcomeView)
		return
	}

	var rendered []string
	width := m.viewport.Width
	if width <= 0 {
		return
	}
	for _, msg := range m.messages {
		var content string

		var timestamp string
		if msg.CreatedAt != "" {
			t, err := time.Parse(time.RFC3339, msg.CreatedAt)
			if err == nil {
				timestamp = t.Format("15:04")
			} else {
				t, err = time.Parse("2006-01-02 15:04:05", msg.CreatedAt)
				if err == nil {
					timestamp = t.Format("15:04")
				} else {
					t, err = time.Parse("2006-01-02T15:04:05.999999", msg.CreatedAt)
					if err == nil {
						timestamp = t.Format("15:04")
					}
				}
			}
		}
		if timestamp == "" {
			timestamp = time.Now().Format("15:04")
		}
		tsMuted := lipgloss.NewStyle().Foreground(styles.MutedColor).Render(timestamp)

		if msg.Role == "assistant" || msg.Role == "system" {
			label := styles.RoleLabelAssistant.Render("[nexus]")
			spaces := width - lipgloss.Width(label) - lipgloss.Width(tsMuted)
			if spaces < 0 {
				spaces = 0
			}
			headerLine := label + strings.Repeat(" ", spaces) + tsMuted

			text := styles.AssistantMessageStyle.Width(width - 2).Render(msg.Content)
			content = fmt.Sprintf("%s\n%s", headerLine, text)
		} else {
			userLabel := tsMuted + " " + styles.RoleLabelUser.Render("[you]")
			spaces := width - lipgloss.Width(userLabel)
			if spaces < 0 {
				spaces = 0
			}
			headerLine := strings.Repeat(" ", spaces) + userLabel

			text := styles.UserMessageStyle.Width(width).Align(lipgloss.Right).Render(msg.Content)
			content = fmt.Sprintf("%s\n%s", headerLine, text)
		}
		rendered = append(rendered, content)
	}
	m.viewport.SetContent(strings.Join(rendered, "\n\n"))
}

func (m ChatModel) View() string {
	status := styles.StatusConnectedStyle.Render("● connected")
	if !m.connected {
		status = styles.StatusDisconnectedStyle.Render("● disconnected")
	}

	headerText := fmt.Sprintf("%s%s",
		styles.NexusLogoStyle.Render("nexus"),
		lipgloss.NewStyle().Width(m.width-12).Align(lipgloss.Right).Render(status),
	)
	header := styles.HeaderStyle.Width(m.width - 4).Render(headerText)

	sidebarWidth := 25
	if m.width < 80 || m.hideSidebar {
		sidebarWidth = 0
	}

	vp := m.viewport.View()

	var inputView string
	if m.isLoading {
		inputView = fmt.Sprintf("%s thinking...", m.spinner.View())
	} else {
		inputView = "> " + m.input.View()
	}

	help := styles.HelpRowStyle.Render("enter send · tab focus · ctrl+n new · ctrl+l clear local · ctrl+c quit")

	mainViewWidth := m.width - sidebarWidth - 6

	var dropdownView string
	if m.isCommandMode() {
		matched := m.getMatchedCommands()
		if len(matched) > 0 {
			var cmdLines []string
			cmdLines = append(cmdLines, styles.SidebarTitle.Foreground(styles.PrimaryColor).Render("Available Commands"))
			for i, cmd := range matched {
				var line string
				if i == m.commandIdx {
					line = styles.SidebarItemActive.Render(fmt.Sprintf("▸ %-12s %s", cmd.Name, cmd.Description))
				} else {
					line = styles.SidebarItemInactive.Render(fmt.Sprintf("  %-12s %s", cmd.Name, cmd.Description))
				}
				cmdLines = append(cmdLines, line)
			}
			dropdownView = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(styles.PrimaryColor).
				Padding(0, 1).
				Width(mainViewWidth - 2).
				Render(strings.Join(cmdLines, "\n"))
		}
	}

	var mainView string
	if dropdownView != "" {
		mainView = lipgloss.JoinVertical(lipgloss.Left,
			vp,
			dropdownView,
			lipgloss.NewStyle().Width(mainViewWidth).Render(inputView),
			lipgloss.NewStyle().Width(mainViewWidth).Render(help),
		)
	} else {
		mainView = lipgloss.JoinVertical(lipgloss.Left,
			vp,
			lipgloss.NewStyle().Width(mainViewWidth).Render(inputView),
			lipgloss.NewStyle().Width(mainViewWidth).Render(help),
		)
	}

	var chatArea string
	if sidebarWidth > 0 {
		var sbLines []string
		var sbTitle string
		if m.focusSidebar {
			sbTitle = styles.SidebarTitle.Foreground(styles.PrimaryColor).Render("Conversations (Focused)")
		} else {
			sbTitle = styles.SidebarTitle.Render("Conversations")
		}
		sbLines = append(sbLines, sbTitle)

		for i, c := range m.conversations {
			title := c.Title
			if title == "" {
				title = fmt.Sprintf("Chat %d", i+1)
			}
			if len(title) > 20 {
				title = title[:17] + "..."
			}

			var item string
			if i == m.activeIdx {
				item = styles.SidebarItemActive.Render("▸ " + title)
			} else if i == m.selectedIdx && m.focusSidebar {
				item = styles.SidebarItemActive.Render("• " + title)
			} else {
				item = styles.SidebarItemInactive.Render("  " + title)
			}
			sbLines = append(sbLines, item)
		}

		sidebarView := styles.SidebarStyle.Width(sidebarWidth).Height(m.viewport.Height + 4).Render(strings.Join(sbLines, "\n"))
		mainViewStyle := lipgloss.NewStyle().PaddingLeft(2)
		chatArea = lipgloss.JoinHorizontal(lipgloss.Top, sidebarView, mainViewStyle.Render(mainView))
	} else {
		chatArea = mainView
	}

	body := header + "\n" + chatArea

	return styles.AppContainer.Render(
		lipgloss.NewStyle().Padding(0, 2).Render(body),
	)
}

type convListFetchedMsg struct {
	conversations []api.Conversation
	err           error
}

func fetchConvListCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		convs, err := client.GetConversations()
		return convListFetchedMsg{conversations: convs, err: err}
	}
}

type convCreatedMsg struct {
	conv *api.Conversation
	err  error
}

func createConvCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		conv, err := client.CreateConversation()
		return convCreatedMsg{conv: conv, err: err}
	}
}

type messagesFetchedMsg struct {
	messages []api.Message
	err      error
}

func fetchMessagesCmd(client *api.Client, convID string) tea.Cmd {
	return func() tea.Msg {
		msgs, err := client.GetMessages(convID)
		if msgs == nil {
			msgs = []api.Message{}
		}
		return messagesFetchedMsg{messages: msgs, err: err}
	}
}

type messageSentMsg struct {
	msg *api.Message
	err error
}

func sendMessageCmd(client *api.Client, convID, msg string) tea.Cmd {
	return func() tea.Msg {
		m, err := client.Chat(convID, msg)
		return messageSentMsg{msg: m, err: err}
	}
}
