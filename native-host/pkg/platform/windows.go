package platform

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
	"unsafe"
)

var (
	user32    = syscall.NewLazyDLL("user32.dll")
	comdlg32  = syscall.NewLazyDLL("comdlg32.dll")
)

var (
	procMessageBoxW = user32.NewProc("MessageBoxW")
)

type WindowsPlatform struct{}

func NewWindowsPlatform() *WindowsPlatform {
	return &WindowsPlatform{}
}

func (p *WindowsPlatform) GetOS() string {
	return runtime.GOOS
}

func (p *WindowsPlatform) ShowMessageBox(title, text string, style uint32) int {
	ret, _, _ := procMessageBoxW.Call(
		0,
		uintptr(unsafe.Pointer(utf16Ptr(text))),
		uintptr(unsafe.Pointer(utf16Ptr(title))),
		uintptr(style),
	)
	return int(ret)
}

func (p *WindowsPlatform) SelectFile(title, filter string, initialDir string) (string, error) {
	// Build PowerShell command
	psCommand := fmt.Sprintf(
		`Add-Type -AssemblyName System.Windows.Forms; `+
		`$f = New-Object System.Windows.Forms.OpenFileDialog; `+
		`$f.Filter = '%s'; `+
		`$f.Title = '%s'; `,
		filter, title,
	)

	if initialDir != "" {
		psCommand += fmt.Sprintf(`$f.InitialDirectory = '%s'; `, initialDir)
	}

	psCommand += `if($f.ShowDialog() -eq 'OK') { $f.FileName }`

	cmd := exec.Command("powershell", "-NoProfile", "-Command", psCommand)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("powershell error: %v", err)
	}

	path := strings.TrimSpace(string(out))
	if path == "" {
		return "", fmt.Errorf("user cancelled or no file selected")
	}

	return path, nil
}

func (p *WindowsPlatform) WriteRegistry(key, value string) error {
	cmd := exec.Command("reg", "add", key, "/ve", "/t", "REG_SZ", "/d", value, "/f")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("registry registration failed: %v", err)
	}
	return nil
}

func (p *WindowsPlatform) DeleteRegistry(key string) error {
	cmd := exec.Command("reg", "delete", key, "/f")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("registry deletion failed: %v", err)
	}
	return nil
}

func (p *WindowsPlatform) RegistryExists(key string) bool {
	cmd := exec.Command("reg", "query", key)
	err := cmd.Run()
	return err == nil
}

// Internal helper
func utf16Ptr(s string) *uint16 {
	ptr, _ := syscall.UTF16PtrFromString(s)
	return ptr
}
