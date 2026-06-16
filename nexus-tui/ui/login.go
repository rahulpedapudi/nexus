package ui

import (
	"fmt"
	"strings"

	"nexus-tui/api"
	"nexus-tui/config"
	"nexus-tui/styles"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
)

type LoginDoneMsg struct {
	AccessToken string
}

type LoginModel struct {
	form       *huh.Form
	spinner    spinner.Model
	isLoading  bool
	err        error
	cfg        *config.Config
	client     *api.Client
	width      int
	height     int
	isRegister bool
}

func NewLoginModel(cfg *config.Config, client *api.Client) LoginModel {
	s := spinner.New()
	s.Spinner = spinner.Dot

	m := LoginModel{
		spinner:    s,
		cfg:        cfg,
		client:     client,
		isRegister: false,
	}
	m.recreateForm()
	return m
}

func (m *LoginModel) recreateForm() {
	if m.isRegister {
		m.form = huh.NewForm(
			huh.NewGroup(
				huh.NewInput().
					Title("Username").
					Description("Choose your username").
					Placeholder("e.g. johndoe").
					Key("username"),
				huh.NewInput().
					Title("Email").
					Description("Your email address").
					Placeholder("e.g. john@example.com").
					Validate(func(str string) error {
						if !strings.Contains(str, "@") {
							return fmt.Errorf("invalid email address")
						}
						return nil
					}).
					Key("email"),
				huh.NewInput().
					Title("Password").
					Description("Choose a secure password").
					EchoMode(huh.EchoModePassword).
					Placeholder("••••••••").
					Key("password"),
			),
		)
	} else {
		m.form = huh.NewForm(
			huh.NewGroup(
				huh.NewInput().
					Title("Username").
					Description("Your secure account username").
					Placeholder("e.g. admin").
					Key("username"),
				huh.NewInput().
					Title("Password").
					Description("Your secure account password").
					EchoMode(huh.EchoModePassword).
					Placeholder("••••••••").
					Key("password"),
			),
		)
	}
	m.form.Init()
	m.form.WithWidth(styles.ResponsiveWidth(m.width))
}

func (m *LoginModel) toggleMode() {
	m.isRegister = !m.isRegister
	m.err = nil
	m.recreateForm()
}

func (m LoginModel) Init() tea.Cmd {
	return tea.Batch(m.form.Init(), m.spinner.Tick)
}

func (m LoginModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		m.form.WithWidth(styles.ResponsiveWidth(msg.Width))

	case tea.KeyMsg:
		if msg.String() == "ctrl+r" && !m.isLoading {
			m.toggleMode()
			return m, nil
		}

	case loginDoneMsg:
		m.isLoading = false
		if msg.err != nil {
			m.err = msg.err
			m.recreateForm()
		} else {
			m.cfg.AccessToken = msg.auth.AccessToken
			m.cfg.RefreshToken = msg.auth.RefreshToken
			m.cfg.TelegramLinked = msg.user.IsSetupComplete
			m.cfg.UserName = msg.user.Username
			config.Save(m.cfg)

			m.client.AccessToken = msg.auth.AccessToken
			token := msg.auth.AccessToken

			return m, func() tea.Msg {
				return LoginDoneMsg{AccessToken: token}
			}
		}
	}

	if !m.isLoading {
		form, cmd := m.form.Update(msg)
		if f, ok := form.(*huh.Form); ok {
			m.form = f
		}
		cmds = append(cmds, cmd)

		if m.form.State == huh.StateCompleted {
			username := m.form.GetString("username")
			password := m.form.GetString("password")
			m.isLoading = true
			m.err = nil

			if m.isRegister {
				email := m.form.GetString("email")
				cmds = append(cmds, registerAndLoginCmd(m.client, email, username, password))
			} else {
				cmds = append(cmds, loginCmd(m.client, username, password))
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m LoginModel) View() string {
	var body string
	w := styles.ResponsiveWidth(m.width)

	if m.isLoading {
		if m.isRegister {
			body = fmt.Sprintf("%s Creating account & signing in...", m.spinner.View())
		} else {
			body = fmt.Sprintf("%s Authenticating credentials...", m.spinner.View())
		}
	} else {
		body = m.form.View()
		if m.err != nil {
			errStyle := styles.ErrorTextStyle.Width(w)
			if m.isRegister {
				body += "\n\n" + errStyle.Render(fmt.Sprintf("Registration failed: %v", m.err))
			} else {
				body += "\n\n" + errStyle.Render("Invalid username or password. Please try again.")
			}
		}
	}

	steps := styles.RenderSteps(1)
	
	var titleText, descText, helpText string
	if m.isRegister {
		titleText = "N E X U S ── Account Registration"
		descText = "Create a new local administrator account for your AI assistant."
		helpText = "ctrl+r Login to existing account"
	} else {
		titleText = "N E X U S ── Authentication"
		descText = "Sign in to synchronize configuration and unlock personal assistant access."
		helpText = "ctrl+r Register a new account"
	}

	title := styles.TitleStyle.Render(titleText)
	desc := lipgloss.NewStyle().Foreground(styles.MutedColor).Width(w).MarginBottom(1).Render(descText)
	help := styles.HelpRowStyle.Render(helpText)

	return styles.AppContainer.Render(
		styles.PanelStyle.Width(w + 4).Render(
			steps + "\n" + title + "\n" + desc + "\n" + body + "\n\n" + help,
		),
	)
}

type loginDoneMsg struct {
	auth *api.AuthResponse
	user *api.User
	err  error
}

func loginCmd(client *api.Client, username, password string) tea.Cmd {
	return func() tea.Msg {
		auth, err := client.Login(username, password)
		if err != nil {
			return loginDoneMsg{err: err}
		}

		client.AccessToken = auth.AccessToken
		user, err := client.Me()
		if err != nil {
			return loginDoneMsg{err: err}
		}

		return loginDoneMsg{auth: auth, user: user}
	}
}

func registerAndLoginCmd(client *api.Client, email, username, password string) tea.Cmd {
	return func() tea.Msg {
		_, err := client.Setup(email, username, password)
		if err != nil {
			return loginDoneMsg{err: err}
		}

		auth, err := client.Login(username, password)
		if err != nil {
			return loginDoneMsg{err: err}
		}

		client.AccessToken = auth.AccessToken
		user, err := client.Me()
		if err != nil {
			return loginDoneMsg{err: err}
		}

		return loginDoneMsg{auth: auth, user: user}
	}
}
