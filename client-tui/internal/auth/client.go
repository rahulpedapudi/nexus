package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const baseURL = "http://localhost:8000"

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SetupRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type ChatRequest struct {
	Content string `json:"content"`
}

type ChatResponse struct {
	ID      string `json:"id"`
	Content string `json:"content"`
	Role    string `json:"role"`
}

// func for login, takes username and password and returns a token response (access token and refresh token)
func Login(username, password string) (*TokenResponse, error) {
	body, _ := json.Marshal(LoginRequest{Username: username, Password: password})

	resp, err := http.Post(
		baseURL+"/auth/login",
		"application/json",
		bytes.NewReader(body),
	)

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("login failed (%d): %s", resp.StatusCode, string(raw))
	}

	var tokenResp TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

// func for setup, takes email, username and password and returns an error (nil if successful)
func Setup(email, username, password string) error {
	body, _ := json.Marshal(SetupRequest{Email: email, Username: username, Password: password})

	resp, err := http.Post(
		baseURL+"/auth/setup",
		"application/json",
		bytes.NewReader(body),
	)

	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("setup failed (%d): %s", resp.StatusCode, string(raw))
	}

	return nil
}

// func for sending a chat message, takes access token and message content
func SendChat(accessToken, message string) (*ChatResponse, error) {
	body, _ := json.Marshal(ChatRequest{Content: message})
	req, err := http.NewRequest("POST", baseURL+"/chat", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("unauthorized")
	}

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("chat failed (%d): %s", resp.StatusCode, string(raw))
	}

	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return nil, err
	}

	return &chatResp, nil
}
