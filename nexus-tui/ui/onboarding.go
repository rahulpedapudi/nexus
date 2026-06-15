package ui

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"nexus-tui/api"
	"nexus-tui/config"
	"nexus-tui/styles"
)

type OnboardingDoneMsg struct{}

type OnboardingModel struct {
	cfg       *config.Config
	client    *api.Client
	spinner   spinner.Model
	token     string
	isLoading bool
	err       error
	expiresAt time.Time
	width     int
	height    int
}

func NewOnboardingModel(cfg *config.Config, client *api.Client) OnboardingModel {
	s := spinner.New()
	s.Spinner = spinner.Dot

	return OnboardingModel{
		cfg:       cfg,
		client:    client,
		spinner:   s,
		isLoading: true,
	}
}

func (m OnboardingModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		fetchTokenCmd(m.client),
	)
}

func (m OnboardingModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	var cmd tea.Cmd
	m.spinner, cmd = m.spinner.Update(msg)
	cmds = append(cmds, cmd)

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "s", "S":
			m.cfg.TelegramLinked = false
			config.Save(m.cfg)
			return m, func() tea.Msg { return OnboardingDoneMsg{} }
		}

	case tokenFetchedMsg:
		m.isLoading = false
		if msg.err != nil {
			m.err = msg.err
		} else {
			m.token = msg.token
			m.expiresAt = time.Now().Add(10 * time.Minute)
			cmds = append(cmds, pollMeCmd(m.client), tickCmd())
		}

	case tickMsg:
		if time.Now().After(m.expiresAt) {
			m.err = fmt.Errorf("token expired")
		} else {
			cmds = append(cmds, tickCmd())
		}

	case pollMeDoneMsg:
		if msg.err == nil && msg.user.IsSetupComplete {
			m.cfg.TelegramLinked = true
			config.Save(m.cfg)
			return m, func() tea.Msg { return OnboardingDoneMsg{} }
		}
		cmds = append(cmds, tea.Tick(3*time.Second, func(t time.Time) tea.Msg {
			return doPollCmd(m.client)()
		}))
	}

	return m, tea.Batch(cmds...)
}

func (m OnboardingModel) View() string {
	var body string
	w := styles.ResponsiveWidth(m.width)

	if m.isLoading {
		body = fmt.Sprintf("%s Generating integration link token...", m.spinner.View())
	} else if m.err != nil {
		errStyle := styles.ErrorTextStyle.Width(w)
		body = errStyle.Render(fmt.Sprintf("Error occurred: %v\n\nPress [s] to Skip onboarding and enter chat", m.err))
	} else {
		tokenBox := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(styles.PrimaryColor).
			Padding(1, 2).
			Bold(true).
			Width(w - 4).
			Render(fmt.Sprintf("/link %s", m.token))

		timeLeft := m.expiresAt.Sub(time.Now())
		mins := int(timeLeft.Minutes())
		secs := int(timeLeft.Seconds()) % 60
		timer := fmt.Sprintf("Token will expire in: %02d:%02d", mins, secs)

		body = lipgloss.NewStyle().Width(w).Render(
			"1. Open your Telegram Messenger client.\n" +
			"2. Message your Nexus Telegram bot and send this activation command:\n\n",
		) + tokenBox + "\n\n" +
			lipgloss.NewStyle().Foreground(styles.MutedColor).Render(timer) + "\n\n" +
			fmt.Sprintf("%s Listening for bot link verification...", m.spinner.View()) + "\n\n" +
			styles.HelpRowStyle.Render("[s] Skip Telegram linking and enter chat")
	}

	steps := styles.RenderSteps(2)
	title := styles.TitleStyle.Render("N E X U S ── Telegram Integration")
	desc := lipgloss.NewStyle().Foreground(styles.MutedColor).Width(w).MarginBottom(1).Render(
		"Connect Telegram to chat and interact with your personal assistant from anywhere.",
	)

	return styles.AppContainer.Render(
		styles.PanelStyle.Width(w + 4).Render(
			steps + "\n" + title + "\n" + desc + "\n" + body,
		),
	)
}

type tokenFetchedMsg struct {
	token string
	err   error
}

func fetchTokenCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		token, err := client.GenerateLinkToken()
		return tokenFetchedMsg{token: token, err: err}
	}
}

type tickMsg time.Time

func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

type pollMeDoneMsg struct {
	user *api.User
	err  error
}

func doPollCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		user, err := client.Me()
		return pollMeDoneMsg{user: user, err: err}
	}
}

func pollMeCmd(client *api.Client) tea.Cmd {
	return tea.Tick(3*time.Second, func(t time.Time) tea.Msg {
		return doPollCmd(client)()
	})
}
