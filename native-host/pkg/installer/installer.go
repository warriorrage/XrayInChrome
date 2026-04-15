package installer

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/xrayinchrome/native-host/pkg/platform"
)

type Config struct {
	XrayPath string `json:"xray_path"`
}

type Installer struct {
	platform platform.Platform
	hostName string
}

func NewInstaller(p platform.Platform, hostName string) *Installer {
	return &Installer{
		platform: p,
		hostName: hostName,
	}
}

func (i *Installer) Install(extensionID, xrayPath string) error {
	exePath, _ := os.Executable()
	absPath, _ := filepath.Abs(exePath)
	workDir := filepath.Dir(absPath)

	tempDir, err := os.MkdirTemp(workDir, "xray-setup-*")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	absXrayPath, _ := filepath.Abs(xrayPath)
	cfg := Config{XrayPath: absXrayPath}
	cfgBytes, _ := json.MarshalIndent(cfg, "", "  ")
	tempConfigPath := filepath.Join(tempDir, "config.json")
	if err := os.WriteFile(tempConfigPath, cfgBytes, 0644); err != nil {
		return fmt.Errorf("failed to write temp config: %v", err)
	}

	manifest := map[string]interface{}{
		"name":        i.hostName,
		"description": "Xray In Chrome Native Host",
		"path":        absPath,
		"type":        "stdio",
		"allowed_origins": []string{
			"chrome-extension://" + extensionID + "/",
		},
	}
	manifestBytes, _ := json.MarshalIndent(manifest, "", "  ")
	tempManifestPath := filepath.Join(tempDir, i.hostName+".json")
	if err := os.WriteFile(tempManifestPath, manifestBytes, 0644); err != nil {
		return fmt.Errorf("failed to write temp manifest: %v", err)
	}

	manifestFinalPath := filepath.Join(workDir, i.hostName+".json")
	if err := i.platform.WriteRegistry(
		`HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts`+i.hostName,
		manifestFinalPath,
	); err != nil {
		return err
	}

	finalConfigPath := filepath.Join(workDir, "config.json")
	if err := os.Rename(tempConfigPath, finalConfigPath); err != nil {
		return fmt.Errorf("failed to commit config: %v", err)
	}

	finalManifestPath := filepath.Join(workDir, i.hostName+".json")
	if err := os.Rename(tempManifestPath, finalManifestPath); err != nil {
		return fmt.Errorf("failed to commit manifest: %v", err)
	}

	return nil
}

func (i *Installer) Uninstall() error {
	exePath, _ := os.Executable()
	absPath, _ := filepath.Abs(exePath)
	workDir := filepath.Dir(absPath)

	if err := i.platform.DeleteRegistry(
		`HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts` + i.hostName,
	); err != nil {
		return err
	}

	os.Remove(filepath.Join(workDir, "config.json"))
	os.Remove(filepath.Join(workDir, i.hostName+".json"))

	return nil
}
