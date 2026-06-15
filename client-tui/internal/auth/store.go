package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

type TokenStore struct {
	AccessToken      string    `json:"access_token"`
	RefreshToken     string    `json:"refresh_token"`
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	Email            string    `json:"email"`
}

// specifies the path of the store, which is ./home/.nexus/client.json
func storePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".nexus", "client.json"), nil
}

// func to save tokens in .nexus/client.json with 0600 permissions (owner read/ write only)
func SaveTokens(store TokenStore) error {
	path, err := storePath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return err
	}

	return nil
}

// func to loadTokens in a store variable
func LoadTokens() (*TokenStore, error) {
	path, err := storePath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var store TokenStore

	if err := json.Unmarshal(data, &store); err != nil {
		return nil, err
	}

	return &store, nil
}

// func to clear tokens (ideally for logging out)
func ClearTokens() error {
	path, err := storePath()
	if err != nil {
		return err
	}

	return os.Remove(path)
}
