package main

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"charm.land/huh/v2"
	"charm.land/huh/v2/spinner"
	"charm.land/lipgloss/v2"
)

type User struct {
	Name         string
	Instructions string
	Submit       bool
}

func main() {

	user := User{}

	// Should we run in accessible mode?
	accessible, _ := strconv.ParseBool(os.Getenv("ACCESSIBLE"))

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Value(&user.Name).
				Title("What's your name?").
				Placeholder("Margaret Thatcher").
				Validate(func(s string) error {
					if s == "Frank" {
						return errors.New("no franks, sorry")
					}
					return nil
				}),
			huh.NewInput().
				Value(&user.Instructions).
				Title("Prompt").
				Placeholder("how can i help you").
				Validate(func(s string) error {
					if s == "Frank" {
						return errors.New("no franks, sorry")
					}
					return nil
				}),
			huh.NewConfirm().
				Title("Submit").
				Value(&user.Submit).
				Affirmative("Yes!").
				Negative("No."),
		),
	).WithAccessible(accessible)

	err := form.Run()
	if err != nil {
		fmt.Println("Uh oh:", err)
		os.Exit(1)
	}

	Thinking := func() {
		time.Sleep(2 * time.Second)
	}

	_ = spinner.New().Title("Thinking").WithAccessible(accessible).Action(Thinking).Run()

	// Print order summary.
	{
		var sb strings.Builder
		keyword := func(s string) string {
			return lipgloss.NewStyle().Foreground(lipgloss.Color("212")).Render(s)
		}
		fmt.Fprintf(&sb,
			"%s\n\nUser Name: %s \n\nPrompt: %s",
			lipgloss.NewStyle().Bold(true).Render("User Details"),
			keyword(user.Name),
			keyword(user.Instructions),
		)

		if user.Submit {
			fmt.Fprint(&sb, "\n\nThanks for trying this out")
		}

		fmt.Println(
			lipgloss.NewStyle().
				Width(40).
				BorderStyle(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("63")).
				Padding(1, 2).
				Render(sb.String()),
		)
	}
}
