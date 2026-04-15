package util

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

// GetXrayPath attempts to find the xray executable.
func GetXrayPath() string {
	selfPath, _ := os.Executable()
	baseDir := filepath.Dir(selfPath)
	
	configPath := filepath.Join(baseDir, "config.json")
	if data, err := os.ReadFile(configPath); err == nil {
		var cfg struct {
			XrayPath string `json:"xray_path"`
		}
		if err := json.Unmarshal(data, &cfg); err == nil && cfg.XrayPath != "" {
			if _, err := os.Stat(cfg.XrayPath); err == nil {
				return cfg.XrayPath
			}
		}
	}

	exeName := "xray.exe"
	if runtime.GOOS != "windows" {
		exeName = "xray"
	}
	defaultPath := filepath.Join(baseDir, exeName)
	if _, err := os.Stat(defaultPath); err == nil {
		return defaultPath
	}

	return ""
}

// CleanupTempLinks deletes and recreates the templinks directory.
func CleanupTempLinks() {
	selfPath, _ := os.Executable()
	baseDir := filepath.Dir(selfPath)
	tempDir := filepath.Join(baseDir, "templinks")
	if _, err := os.Stat(tempDir); err == nil {
		_ = os.RemoveAll(tempDir)
	}
	_ = os.MkdirAll(tempDir, 0755)
}
