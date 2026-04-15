package platform

// Platform defines the interface for OS-specific operations.
type Platform interface {
	ShowMessageBox(title, text string, style uint32) int
	SelectFile(title, filter string, initialDir string) (string, error)
	WriteRegistry(key, value string) error
	DeleteRegistry(key string) error
	RegistryExists(key string) bool
	GetOS() string
}
