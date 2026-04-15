package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/xrayinchrome/native-host/pkg/config"
	"github.com/xrayinchrome/native-host/pkg/installer"
	"github.com/xrayinchrome/native-host/pkg/messaging"
	"github.com/xrayinchrome/native-host/pkg/platform"
	"github.com/xrayinchrome/native-host/pkg/util"
	"github.com/xrayinchrome/native-host/pkg/xray"
)

const hostName = "com.xray.host"

func main() {
	p := platform.GetPlatform()

	if runtime.GOOS == "windows" && isStandalone() {
		runGuiSetup(p)
		return
	}

	runNativeMessagingLoop(p)
}

func isStandalone() bool {
	fileInfo, err := os.Stdin.Stat()
	if err != nil {
		return true
	}
	return (fileInfo.Mode() & os.ModeCharDevice) != 0
}

func runGuiSetup(p platform.Platform) {
	title := "Xray In Chrome Setup"
	msg := `What would you like to do?

Yes: Install or Update the bridge
No: Uninstall the bridge
Cancel: Exit`

	res := p.ShowMessageBox(title, msg, 0x00000003|0x00000040) // MB_YESNOCANCEL | MB_ICONINFORMATION

	switch res {
	case 6: // IDYES
		initialDir := ""
		selfPath, _ := os.Executable()
		configPath := filepath.Join(filepath.Dir(selfPath), "config.json")
		if data, err := os.ReadFile(configPath); err == nil {
			var cfg struct {
				XrayPath string `json:"xray_path"`
			}
			if err := json.Unmarshal(data, &cfg); err == nil {
				initialDir = filepath.Dir(cfg.XrayPath)
			}
		}

		path, err := p.SelectFile("Please select your xray.exe core file", "Executable Files (*.exe)|*.exe|All Files (*.*)|*.*", initialDir)
		if err != nil {
			return
		}

		fixedExtID := "dijagbplhpidjbefjeojdefkgflbmekj"
		inst := installer.NewInstaller(p, hostName)
		if err := inst.Install(fixedExtID, path); err != nil {
			p.ShowMessageBox("Installation Error", "Failed to install: "+err.Error(), 0x00000000|0x00000010) // MB_OK | MB_ICONERROR
		} else {
			p.ShowMessageBox("Success", "Installation Successful! You can now start the extension in Chrome.", 0x00000000|0x00000040) // MB_OK | MB_ICONINFORMATION
		}

	case 7: // IDNO
		inst := installer.NewInstaller(p, hostName)
		if err := inst.Uninstall(); err != nil {
			p.ShowMessageBox("Uninstall Error", "Failed to uninstall: "+err.Error(), 0x00000000|0x00000010)
		} else {
			p.ShowMessageBox("Success", "Xray Bridge has been successfully uninstalled.", 0x00000000|0x00000040)
		}
	}
}

func runNativeMessagingLoop(p platform.Platform) {
	util.CleanupTempLinks()

	xrayPath := util.GetXrayPath()
	xrayMgr := xray.NewManager(xrayPath)
	logWriter := &messagingWriter{}

	for {
		msg, err := messaging.ReadMessage(os.Stdin)
		if err != nil {
			xrayMgr.Stop()
			break
		}

		switch msg.Action {
		case "start":
			handleStart(msg, xrayMgr, logWriter)
		case "stop":
			xrayMgr.Stop()
			messaging.SendMessage(os.Stdout, messaging.Message{Action: "status-report", Content: "stopped"})
		case "status":
			status := xrayMgr.GetStatus()
			messaging.SendMessage(os.Stdout, messaging.Message{Action: "status-report", Content: status, Type: "xray"})
		case "check":
			handleCheck(p, xrayMgr)
		case "select_file":
			handleSelectFile(p)
		case "ping":
			messaging.SendMessage(os.Stdout, messaging.Message{Action: "pong", Content: "Alive"})
		}
	}
}

func handleStart(msg *messaging.Message, mgr *xray.Manager, writer io.Writer) {
	selfPath, _ := os.Executable()
	baseDir := filepath.Dir(selfPath)
	var finalArgs []string
	var configPath string

	switch v := msg.Content.(type) {
	case string:
		input := v
		if strings.HasPrefix(input, "vless://") || strings.HasPrefix(input, "vmess://") || strings.HasPrefix(input, "trojan://") || strings.HasPrefix(input, "ss://") {
			path, err := config.GenerateConfigFromLink(input, baseDir, msg.SocksPort, msg.HttpPort)
			if err != nil {
				sendLog(writer, "[Error] Link conversion failed: "+err.Error())
				return
			}
			configPath = path
		} else {
			// Handle raw arguments string
			rawArgs := strings.Fields(input)
			for i := 0; i < len(rawArgs); i++ {
				arg := strings.Trim(rawArgs[i], "\"")
				if arg == "-c" && i+1 < len(rawArgs) {
					path := strings.Trim(rawArgs[i+1], "\"")
					if !strings.Contains(path, "templinks") {
						newPath, err := config.OverrideConfigPorts(path, baseDir, msg.SocksPort, msg.HttpPort)
						if err == nil {
							configPath = newPath
						} else {
							configPath = path
						}
					} else {
						configPath = path
					}
					break // Use the first -c found
				}
			}
		}
	case []interface{}:
		for _, item := range v {
			arg, ok := item.(string)
			if !ok { continue }
			if strings.HasPrefix(arg, "vless://") || strings.HasPrefix(arg, "vmess://") || strings.HasPrefix(arg, "trojan://") || strings.HasPrefix(arg, "ss://") {
				path, err := config.GenerateConfigFromLink(arg, baseDir, msg.SocksPort, msg.HttpPort)
				if err == nil {
					configPath = path
					break
				}
			} else if strings.Contains(arg, ".json") {
				// If it's a path to a json file
				if !strings.Contains(arg, "templinks") {
					newPath, err := config.OverrideConfigPorts(arg, baseDir, msg.SocksPort, msg.HttpPort)
					if err == nil {
						configPath = newPath
					} else {
						configPath = arg
					}
				} else {
					configPath = arg
				}
				break
			}
		}
	}

	if configPath == "" {
		sendLog(writer, "[Error] No valid configuration source found")
		return
	}

	finalArgs = append(finalArgs, "-c", configPath)
	sendLog(writer, "[Debug] Final config path: "+configPath)

	if err := mgr.Start(finalArgs, writer); err != nil {
		sendLog(writer, "Failed to start: "+err.Error())
	}
}

func handleCheck(p platform.Platform, mgr *xray.Manager) {
	selfPath, _ := os.Executable()
	baseDir := filepath.Dir(selfPath)
	
	configPath := filepath.Join(baseDir, "config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		sendLog(os.Stdout, "[HealthCheck] [WARNING] Configuration file config.json not found.")
	} else {
		sendLog(os.Stdout, "[HealthCheck] [OK] Configuration file config.json is ready.")
	}

	xrayPath := util.GetXrayPath()
	if xrayPath == "" {
		sendLog(os.Stdout, "[HealthCheck] [ERROR] xray.exe not found. Please run install.bat to set the path.")
	} else {
		sendLog(os.Stdout, "[HealthCheck] [OK] Xray path verified: " + xrayPath)
	}

	if p.GetOS() == "windows" {
		regKey := `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts` + hostName
		if p.RegistryExists(regKey) {
			sendLog(os.Stdout, "[HealthCheck] [OK] Registry and manifest paths are consistent.")
		} else {
			sendLog(os.Stdout, "[HealthCheck] [ERROR] Registry entry not found. Native Messaging is not installed.")
		}
	}
	sendLog(os.Stdout, "[HealthCheck] Diagnosis complete.")
}

func handleSelectFile(p platform.Platform) {
	path, err := p.SelectFile("Select Xray Configuration File", "JSON Files (*.json)|*.json|All Files (*.*)|*.*", "")
	if err != nil {
		messaging.SendMessage(os.Stdout, messaging.Message{Action: "select_file_result", Content: "cancelled"})
		return
	}
	messaging.SendMessage(os.Stdout, messaging.Message{Action: "select_file_result", Content: path})
}

type messagingWriter struct{}

func (mw *messagingWriter) Write(p []byte) (n int, err error) {
	messaging.SendMessage(os.Stdout, messaging.Message{
		Action: "log",
		Content: string(p),
	})
	return len(p), nil
}

func sendLog(w io.Writer, text string) {
	if writer, ok := w.(*messagingWriter); ok {
		writer.Write([]byte(text + "\n"))
	} else {
		messaging.SendMessage(os.Stdout, messaging.Message{
			Action: "log",
			Content: text,
		})
	}
}
