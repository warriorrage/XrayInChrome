package config

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// GenerateConfigFromLink creates a full Xray configuration from a proxy link.
func GenerateConfigFromLink(link, baseDir string, socksPort, httpPort int) (string, error) {
	outbound, err := ParseLink(link)
	if err != nil {
		return "", err
	}

	cfg := buildXrayConfig(outbound, socksPort, httpPort)
	
	tempDir := filepath.Join(baseDir, "templinks")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", err
	}

	jsonPath := filepath.Join(tempDir, generateID()+".json")
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(jsonPath, data, 0644); err != nil {
		return "", err
	}

	return jsonPath, nil
}

// OverrideConfigPorts reads an existing config and updates its inbounds to the specified ports.
func OverrideConfigPorts(configPath, baseDir string, socksPort, httpPort int) (string, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", err
	}

	var cfg XrayConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", err
	}

	if socksPort == 0 { socksPort = 10808 }
	if httpPort == 0 { httpPort = 10809 }

	newInbounds := []InboundConfig{
		{
			Port: socksPort, Listen: "127.0.0.1", Protocol: "socks",
			Settings: map[string]interface{}{"udp": true},
		},
		{
			Port: httpPort, Listen: "127.0.0.1", Protocol: "http",
		},
	}

	// Preserve API inbounds
	for _, ib := range cfg.Inbounds {
		if ib.Tag == "api" {
			newInbounds = append(newInbounds, ib)
		}
	}
	cfg.Inbounds = newInbounds

	// Auto-correct deprecated Host field in WS settings and clean up freedom outbounds
	for i := range cfg.Outbounds {
		ob := &cfg.Outbounds[i]
		if ob.Protocol == "freedom" {
			ob.StreamSettings = nil
		}
		if ob.StreamSettings != nil && ob.StreamSettings.WsSettings != nil {
			if headers, ok := ob.StreamSettings.WsSettings["headers"].(map[string]interface{}); ok {
				if host, exists := headers["Host"]; exists {
					ob.StreamSettings.WsSettings["host"] = host
					delete(headers, "Host")
				}
				if len(headers) == 0 {
					delete(ob.StreamSettings.WsSettings, "headers")
				}
			}
		}
	}

	tempDir := filepath.Join(baseDir, "templinks")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", err
	}

	jsonPath := filepath.Join(tempDir, "override-"+generateID()+".json")
	newData, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(jsonPath, newData, 0644); err != nil {
		return "", err
	}

	return jsonPath, nil
}

func buildXrayConfig(outbound *OutboundConfig, socksPort, httpPort int) XrayConfig {
	if socksPort == 0 { socksPort = 10808 }
	if httpPort == 0 { httpPort = 10809 }

	return XrayConfig{
		Log: LogConfig{LogLevel: "warning"},
		Inbounds: []InboundConfig{
			{
				Port: socksPort, Listen: "127.0.0.1", Protocol: "socks",
				Settings: map[string]interface{}{"udp": true},
			},
			{
				Port: httpPort, Listen: "127.0.0.1", Protocol: "http",
			},
		},
		Outbounds: []OutboundConfig{
			*outbound,
			{Protocol: "freedom", Tag: "direct"},
		},
	}
}

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
