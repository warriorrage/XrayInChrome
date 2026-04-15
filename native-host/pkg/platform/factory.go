package platform

import (
	"fmt"
	"runtime"
)

// GetPlatform returns the platform implementation for the current OS.
func GetPlatform() Platform {
	switch runtime.GOOS {
	case "windows":
		return NewWindowsPlatform()
	default:
		// Return a basic platform or handle unsupported OS
		return &DefaultPlatform{}
	}
}

// DefaultPlatform provides a fallback for non-windows systems.
type DefaultPlatform struct{}

func (p *DefaultPlatform) ShowMessageBox(title, text string, style uint32) int {
	return 0 // Not implemented
}

func (p *DefaultPlatform) SelectFile(title, filter string, initialDir string) (string, error) {
	return "", fmt.Errorf("file selection not supported on this platform")
}

func (p *DefaultPlatform) WriteRegistry(key, value string) error {
	return fmt.Errorf("registry not supported on this platform")
}

func (p *DefaultPlatform) DeleteRegistry(key string) error {
	return fmt.Errorf("registry not supported on this platform")
}

func (p *DefaultPlatform) RegistryExists(key string) bool {
	return false
}

func (p *DefaultPlatform) GetOS() string {
	return runtime.GOOS
}
