package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
	"github.com/charmbracelet/lipgloss"
	"nexus-tui/api"
	"nexus-tui/styles"
)

type SetupDoneMsg struct {
	URL string
}

type SetupModel struct {
	form      *huh.Form
	spinner   spinner.Model
	isLoading bool
	err       error
	success   bool
	width     int
	height    int
}

func NewSetupModel() SetupModel {
	s := spinner.New()
	s.Spinner = spinner.Dot

	f := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("Server URL").
				Description("Where your FastAPI backend is running").
				Placeholder("e.g. http://localhost:8000").
				Value(func() *string { s := "http://localhost:8000"; return &s }()).
				Validate(func(str string) error {
					if !strings.HasPrefix(str, "http://") && !strings.HasPrefix(str, "https://") {
						return fmt.Errorf("URL must start with http:// or https://")
					}
					return nil
				}).
				Key("url"),
		),
	)
	f.Init()

	return SetupModel{
		form:    f,
		spinner: s,
	}
}

func (m SetupModel) Init() tea.Cmd {
	return tea.Batch(m.form.Init(), m.spinner.Tick)
}

func (m SetupModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
		if m.success {
			return m, nil
		}

	case healthCheckDoneMsg:
		m.isLoading = false
		if msg.err != nil {
			m.err = msg.err
			// Recreate form to reset completed state and allow editing/retrying
			m.form = huh.NewForm(
				huh.NewGroup(
					huh.NewInput().
						Title("Server URL").
						Description("Where your FastAPI backend is running").
						Placeholder("e.g. http://localhost:8000").
						Value(&msg.url).
						Validate(func(str string) error {
							if !strings.HasPrefix(str, "http://") && !strings.HasPrefix(str, "https://") {
								return fmt.Errorf("URL must start with http:// or https://")
							}
							return nil
						}).
						Key("url"),
				),
			)
			m.form.Init()
			m.form.WithWidth(styles.ResponsiveWidth(m.width))
		} else {
			m.success = true
			m.err = nil
			return m, tea.Tick(time.Second, func(t time.Time) tea.Msg {
				return SetupDoneMsg{URL: msg.url}
			})
		}
	}

	if !m.isLoading && !m.success {
		form, cmd := m.form.Update(msg)
		if f, ok := form.(*huh.Form); ok {
			m.form = f
		}
		cmds = append(cmds, cmd)

		if m.form.State == huh.StateCompleted {
			url := m.form.GetString("url")
			m.isLoading = true
			m.err = nil
			cmds = append(cmds, checkHealthCmd(url))
		}
	}

	return m, tea.Batch(cmds...)
}

func (m SetupModel) View() string {
	var body string
	w := styles.ResponsiveWidth(m.width)

	if m.success {
		body = styles.SuccessTextStyle.Render("✓ Connected to server")
	} else if m.isLoading {
		body = fmt.Sprintf("%s Connecting...", m.spinner.View())
	} else {
		body = m.form.View()
		if m.err != nil {
			errStyle := styles.ErrorTextStyle.Width(w)
			body += "\n\n" + errStyle.Render(fmt.Sprintf("Could not reach server: %v", m.err))
		}
	}

	steps := styles.RenderSteps(0)
	title := styles.TitleStyle.Render("N E X U S ── Server Setup")
	desc := lipgloss.NewStyle().Foreground(styles.MutedColor).Width(w).MarginBottom(1).Render(
		"Welcome! Connect to your personal AI assistant backend server.",
	)

	return styles.AppContainer.Render(
		styles.PanelStyle.Width(w + 4).Render(
			steps + "\n" + title + "\n" + desc + "\n" + body,
		),
	)
}

type healthCheckDoneMsg struct {
	url string
	err error
}

func checkHealthCmd(url string) tea.Cmd {
	return func() tea.Msg {
		client := api.NewClient(url, "")
		err := client.Health()
		return healthCheckDoneMsg{url: url, err: err}
	}
}
