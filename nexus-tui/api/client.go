package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

var ErrUnauthorized = errors.New("unauthorized")

type Client struct {
	BaseURL     string
	AccessToken string
	HTTPClient  *http.Client
}

func NewClient(baseURL, accessToken string) *Client {
	return &Client{
		BaseURL:     baseURL,
		AccessToken: accessToken,
		HTTPClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) doRequest(method, path string, body interface{}, result interface{}) error {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return err
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	if c.AccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return ErrUnauthorized
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("API error: %s", resp.Status)
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return err
		}
	}

	return nil
}

func (c *Client) Health() error {
	return c.doRequest("GET", "/health", nil, nil)
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
}

func (c *Client) Login(username, password string) (*AuthResponse, error) {
	reqBody := map[string]string{
		"username": username,
		"password": password,
	}
	var res AuthResponse
	err := c.doRequest("POST", "/auth/login", reqBody, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

type User struct {
	Username        string `json:"username"`
	Email           string `json:"email"`
	IsSetupComplete bool   `json:"is_setup_complete"`
}

func (c *Client) Me() (*User, error) {
	var res User
	err := c.doRequest("GET", "/auth/me", nil, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) Setup(email, username, password string) (*User, error) {
	reqBody := map[string]string{
		"email":    email,
		"username": username,
		"password": password,
	}
	var res User
	err := c.doRequest("POST", "/auth/setup", reqBody, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

type LinkTokenResponse struct {
	Token string `json:"token"`
}

func (c *Client) GenerateLinkToken() (string, error) {
	var res LinkTokenResponse
	err := c.doRequest("POST", "/auth/generate-link-token", nil, &res)
	if err != nil {
		return "", err
	}
	return res.Token, nil
}

type Message struct {
	ID        string `json:"id"`
	Content   string `json:"content"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
}

func (c *Client) Chat(conversationID string, message string) (*Message, error) {
	reqBody := map[string]interface{}{
		"content": message,
		"source":  "tui",
		"conv_id": conversationID,
	}
	var res Message
	err := c.doRequest("POST", "/chat", reqBody, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetMessages(conversationID string) ([]Message, error) {
	var res []Message
	err := c.doRequest("GET", fmt.Sprintf("/conversations/%s", conversationID), nil, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

type Conversation struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

func (c *Client) CreateConversation() (*Conversation, error) {
	var res Conversation
	err := c.doRequest("POST", "/conversations/", nil, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetConversations() ([]Conversation, error) {
	var res []Conversation
	err := c.doRequest("GET", "/conversations/", nil, &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}
