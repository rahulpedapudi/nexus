package styles

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	PrimaryColor    = lipgloss.Color("#7c6aff")
	SuccessColor    = lipgloss.Color("#4ade80")
	ErrorColor      = lipgloss.Color("#f87171")
	MutedColor      = lipgloss.Color("#71717a")
	TextColor       = lipgloss.Color("#e4e4e7")
	BackgroundColor = lipgloss.Color("#0e0e10")
	SurfaceColor    = lipgloss.Color("#17171a")
	BorderColor     = lipgloss.Color("#2a2a2e")
)

var (
	AppContainer = lipgloss.NewStyle()

	PanelStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(BorderColor).
			Padding(1, 2)

	TitleStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true).
			MarginBottom(1)

	ErrorTextStyle = lipgloss.NewStyle().
			Foreground(ErrorColor).
			MarginTop(1)

	SuccessTextStyle = lipgloss.NewStyle().
			Foreground(SuccessColor).
			MarginTop(1)

	HelpRowStyle = lipgloss.NewStyle().
			Foreground(MutedColor)

	// Chat specific styles
	HeaderStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, false, true, false).
			BorderForeground(BorderColor)

	NexusLogoStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)

	StatusConnectedStyle = lipgloss.NewStyle().
				Foreground(SuccessColor)

	StatusDisconnectedStyle = lipgloss.NewStyle().
				Foreground(ErrorColor)

	AssistantMessageStyle = lipgloss.NewStyle().
				Border(lipgloss.NormalBorder(), false, false, false, true).
				BorderForeground(PrimaryColor).
				PaddingLeft(1)

	UserMessageStyle = lipgloss.NewStyle().
				MarginBottom(0)

	RoleLabelAssistant = lipgloss.NewStyle().
				Foreground(MutedColor)

	RoleLabelUser = lipgloss.NewStyle().
			Foreground(MutedColor).
			Align(lipgloss.Right)

	SidebarStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, true, false, false).
			BorderForeground(BorderColor).
			PaddingRight(2)

	SidebarTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(MutedColor).
			MarginBottom(1)

	SidebarItemActive = lipgloss.NewStyle().
				Foreground(PrimaryColor).
				Bold(true)

	SidebarItemInactive = lipgloss.NewStyle().
				Foreground(MutedColor)
)

func RenderSteps(step int) string {
	steps := []string{"Server Connection", "Authentication", "Telegram Link"}
	var rendered []string
	for i, name := range steps {
		if i == step {
			rendered = append(rendered, lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true).Render(fmt.Sprintf("[● %s]", name)))
		} else if i < step {
			rendered = append(rendered, lipgloss.NewStyle().Foreground(SuccessColor).Render(fmt.Sprintf("✓ %s", name)))
		} else {
			rendered = append(rendered, lipgloss.NewStyle().Foreground(MutedColor).Render(fmt.Sprintf("○ %s", name)))
		}
	}
	separator := lipgloss.NewStyle().Foreground(MutedColor).Render(" ── ")
	return lipgloss.NewStyle().MarginBottom(2).Render(strings.Join(rendered, separator))
}

func ResponsiveWidth(termWidth int) int {
	if termWidth <= 0 {
		return 60
	}
	w := termWidth - 8
	if w > 60 {
		return 60
	}
	if w < 20 {
		return 20
	}
	return w
}
