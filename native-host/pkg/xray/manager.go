package xray

import (
	"bufio"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
)

type Manager struct {
	cmd      *exec.Cmd
	mutex    sync.Mutex
	xrayPath string
}

func NewManager(path string) *Manager {
	return &Manager{xrayPath: path}
}

func (m *Manager) Start(args []string, logWriter io.Writer) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.cmd != nil && m.cmd.Process != nil && m.cmd.ProcessState == nil {
		return fmt.Errorf("Xray is already running")
	}

	if m.xrayPath == "" {
		return fmt.Errorf("xray path not configured")
	}

	cmd := exec.Command(m.xrayPath, args...)

	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}

	cmd.Dir = filepath.Dir(m.xrayPath)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	m.cmd = cmd

	// Stream output to logWriter
	go m.streamOutput(stdout, logWriter)
	go m.streamOutput(stderr, logWriter)

	// Handle process exit
	go func() {
		_ = cmd.Wait()
		m.mutex.Lock()
		m.cmd = nil
		m.mutex.Unlock()
	}()

	return nil
}

func (m *Manager) Stop() error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.cmd != nil && m.cmd.Process != nil {
		err := m.cmd.Process.Kill()
		m.cmd = nil
		return err
	}
	return nil
}

func (m *Manager) GetStatus() string {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.cmd != nil && m.cmd.Process != nil && m.cmd.ProcessState == nil {
		return "running"
	}
	return "stopped"
}

func (m *Manager) streamOutput(pipe io.ReadCloser, writer io.Writer) {
	defer pipe.Close()
	scanner := bufio.NewScanner(pipe)
	for scanner.Scan() {
		// We assume the writer provided is something that can handle 
		// the message format or we wrap the text in a message here.
		// For now, we just write the raw line. 
		// In the final integration, this will be wrapped in a messaging.Message.
		fmt.Fprintln(writer, scanner.Text())
	}
}
