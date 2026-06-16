package ui

import (
	tea "github.com/charmbracelet/bubbletea"
	"nexus-tui/api"
	"nexus-tui/config"
)

type sessionState int

const (
	stateSetup sessionState = iota
	stateAutoLogin
	stateLogin
	stateOnboarding
	stateChat
)

type AppModel struct {
	state      sessionState
	cfg        *config.Config
	client     *api.Client
	setup      SetupModel
	login      LoginModel
	onboarding OnboardingModel
	chat       ChatModel
	width      int
	height     int
}

func NewApp() AppModel {
	m := AppModel{}

	if config.Exists() {
		cfg, err := config.Load()
		if err != nil || cfg.APIURL == "" {
			m.state = stateSetup
			m.setup = NewSetupModel()
		} else {
			m.cfg = cfg
			m.client = api.NewClient(cfg.APIURL, cfg.AccessToken)
			if cfg.AccessToken != "" {
				m.state = stateAutoLogin
			} else {
				m.state = stateLogin
				m.login = NewLoginModel(m.cfg, m.client)
			}
		}
	} else {
		m.state = stateSetup
		m.setup = NewSetupModel()
	}

	return m
}

func (m AppModel) Init() tea.Cmd {
	switch m.state {
	case stateSetup:
		return m.setup.Init()
	case stateAutoLogin:
		return verifyTokenCmd(m.client)
	case stateLogin:
		return m.login.Init()
	default:
		return nil
	}
}

func (m AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.Type == tea.KeyCtrlC {
			return m, tea.Quit
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	}

	switch m.state {
	case stateSetup:
		switch msg := msg.(type) {
		case SetupDoneMsg:
			m.cfg = &config.Config{
				APIURL: msg.URL,
			}
			config.Save(m.cfg)
			m.client = api.NewClient(m.cfg.APIURL, "")
			m.state = stateLogin
			m.login = NewLoginModel(m.cfg, m.client)
			m.login.width = m.width
			m.login.height = m.height
			m.login.recreateForm()
			return m, m.login.Init()
		}
		newModel, cmd := m.setup.Update(msg)
		m.setup = newModel.(SetupModel)
		cmds = append(cmds, cmd)

	case stateAutoLogin:
		switch msg := msg.(type) {
		case autoLoginDoneMsg:
			if msg.ok && msg.user != nil {
				m.cfg.UserName = msg.user.Username
				m.cfg.TelegramLinked = msg.user.IsSetupComplete
				config.Save(m.cfg)

				if msg.user.IsSetupComplete {
					m.state = stateChat
					m.chat = NewChatModel(m.cfg.UserName, m.client)
					newChat, sizeCmd := m.chat.Update(tea.WindowSizeMsg{Width: m.width, Height: m.height})
					m.chat = newChat.(ChatModel)
					return m, tea.Batch(m.chat.Init(), sizeCmd)
				} else {
					m.state = stateOnboarding
					m.onboarding = NewOnboardingModel(m.cfg, m.client)
					m.onboarding.width = m.width
					m.onboarding.height = m.height
					return m, m.onboarding.Init()
				}
			} else {
				m.cfg.AccessToken = ""
				m.cfg.RefreshToken = ""
				config.Save(m.cfg)
				m.client.AccessToken = ""
				m.state = stateLogin
				m.login = NewLoginModel(m.cfg, m.client)
				m.login.width = m.width
				m.login.height = m.height
				m.login.recreateForm()
				return m, m.login.Init()
			}
		}

	case stateLogin:
		switch msg := msg.(type) {
		case LoginDoneMsg:
			m.client.AccessToken = msg.AccessToken
			if m.cfg.TelegramLinked {
				m.state = stateChat
				m.chat = NewChatModel(m.cfg.UserName, m.client)
				newChat, sizeCmd := m.chat.Update(tea.WindowSizeMsg{Width: m.width, Height: m.height})
				m.chat = newChat.(ChatModel)
				cmds = append(cmds, m.chat.Init(), sizeCmd)
			} else {
				m.state = stateOnboarding
				m.onboarding = NewOnboardingModel(m.cfg, m.client)
				m.onboarding.width = m.width
				m.onboarding.height = m.height
				cmds = append(cmds, m.onboarding.Init())
			}
			return m, tea.Batch(cmds...)
		}
		newModel, cmd := m.login.Update(msg)
		m.login = newModel.(LoginModel)
		cmds = append(cmds, cmd)

	case stateOnboarding:
		switch msg.(type) {
		case OnboardingDoneMsg:
			m.state = stateChat
			m.chat = NewChatModel(m.cfg.UserName, m.client)
			newChat, sizeCmd := m.chat.Update(tea.WindowSizeMsg{Width: m.width, Height: m.height})
			m.chat = newChat.(ChatModel)
			cmds = append(cmds, m.chat.Init(), sizeCmd)
			return m, tea.Batch(cmds...)
		}
		newModel, cmd := m.onboarding.Update(msg)
		m.onboarding = newModel.(OnboardingModel)
		cmds = append(cmds, cmd)

	case stateChat:
		switch msg.(type) {
		case LogoutMsg:
			m.cfg.AccessToken = ""
			m.cfg.RefreshToken = ""
			m.cfg.TelegramLinked = false
			m.cfg.UserName = ""
			config.Save(m.cfg)

			m.client.AccessToken = ""
			m.state = stateLogin
			m.login = NewLoginModel(m.cfg, m.client)
			m.login.width = m.width
			m.login.height = m.height
			m.login.recreateForm()
			return m, m.login.Init()
		}
		newModel, cmd := m.chat.Update(msg)
		m.chat = newModel.(ChatModel)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m AppModel) View() string {
	switch m.state {
	case stateSetup:
		return m.setup.View()
	case stateAutoLogin:
		return ""
	case stateLogin:
		return m.login.View()
	case stateOnboarding:
		return m.onboarding.View()
	case stateChat:
		return m.chat.View()
	default:
		return ""
	}
}

type autoLoginDoneMsg struct {
	ok   bool
	user *api.User
}

func verifyTokenCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		user, err := client.Me()
		return autoLoginDoneMsg{ok: err == nil, user: user}
	}
}
