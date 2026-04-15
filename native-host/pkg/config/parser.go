package config

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// ParseLink converts a proxy link (VLESS, VMess, Trojan, SS) into an OutboundConfig.
func ParseLink(link string) (*OutboundConfig, error) {
	link = strings.TrimSpace(link)
	if strings.HasPrefix(link, "vmess://") {
		return parseVmess(link)
	} else if strings.HasPrefix(link, "vless://") {
		return parseVless(link)
	} else if strings.HasPrefix(link, "trojan://") {
		return parseTrojan(link)
	} else if strings.HasPrefix(link, "ss://") {
		return parseSS(link)
	}
	return nil, fmt.Errorf("unknown protocol")
}

func parseVless(link string) (*OutboundConfig, error) {
	u, err := url.Parse(link)
	if err != nil { return nil, err }

	port, _ := strconv.Atoi(u.Port())
	if port == 0 { port = 443 }

	q := u.Query()
	security := q.Get("security")
	net := q.Get("type")
	if net == "" || net == "none" {
		net = "tcp"
	}

	outbound := &OutboundConfig{
		Protocol: "vless",
		Settings: map[string]interface{}{
			"vnext": []interface{}{
				map[string]interface{}{
					"address": u.Hostname(),
					"port":    port,
					"users": []interface{}{
						map[string]interface{}{
							"id":         u.User.Username(),
							"encryption": "none",
							"flow":       q.Get("flow"),
						},
					},
				},
			},
		},
		StreamSettings: &StreamSettings{
			Network:  net,
			Security: security,
		},
	}

	// Handle security settings
	if security == "tls" {
		outbound.StreamSettings.TlsSettings = map[string]interface{}{
			"serverName":    q.Get("sni"),
			"allowInsecure": q.Get("allowInsecure") == "1",
			"fingerprint":   q.Get("fp"),
		}
	} else if security == "reality" {
		outbound.StreamSettings.RealitySettings = map[string]interface{}{
			"fingerprint": q.Get("fp"),
			"serverName":  q.Get("sni"),
			"publicKey":   q.Get("pbk"),
			"shortId":     q.Get("sid"),
			"spiderX":     q.Get("spx"),
		}
	}

	// Handle transport settings
	net = q.Get("type")
	if net == "ws" {
		outbound.StreamSettings.WsSettings = map[string]interface{}{
			"path": q.Get("path"),
			"host": q.Get("host"),
		}
	} else if net == "grpc" {
		outbound.StreamSettings.GrpcSettings = map[string]interface{}{
			"serviceName": q.Get("serviceName"),
			"multiMode":   q.Get("mode") == "multi",
		}
	}

	return outbound, nil
}

func parseVmess(link string) (*OutboundConfig, error) {
	b64 := strings.TrimPrefix(link, "vmess://")
	jsonBytes, err := decodeBase64(b64)
	if err != nil { return nil, fmt.Errorf("vmess base64 error: %v", err) }

	var v map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &v); err != nil { return nil, err }

	var port int
	switch p := v["port"].(type) {
	case string:
		port, _ = strconv.Atoi(p)
	case float64:
		port = int(p)
	}

	net, _ := v["net"].(string)
	if net == "" || net == "none" {
		net = "tcp"
	}

	outbound := &OutboundConfig{
		Protocol: "vmess",
		Settings: map[string]interface{}{
			"vnext": []interface{}{
				map[string]interface{}{
					"address": v["add"],
					"port":    port,
					"users": []interface{}{
						map[string]interface{}{
							"id":       v["id"],
							"alterId":  0, 
							"security": "auto",
						},
					},
				},
			},
		},
		StreamSettings: &StreamSettings{
			Network: net,
			Security: v["tls"].(string),
			TlsSettings: map[string]interface{}{
				"serverName": v["sni"],
			},
			WsSettings: map[string]interface{}{
				"path": v["path"],
				"host": v["host"],
			},
		},
	}
	return outbound, nil
}

func parseTrojan(link string) (*OutboundConfig, error) {
	u, err := url.Parse(link)
	if err != nil { return nil, err }

	port, _ := strconv.Atoi(u.Port())
	if port == 0 { port = 443 }

	outbound := &OutboundConfig{
		Protocol: "trojan",
		Settings: map[string]interface{}{
			"servers": []interface{}{
				map[string]interface{}{
					"address": u.Hostname(),
					"port":    port,
					"password": u.User.Username(),
				},
			},
		},
		StreamSettings: &StreamSettings{
			Network: "tcp",
			Security: "tls",
			TlsSettings: map[string]interface{}{
				"serverName": u.Query().Get("sni"),
				"allowInsecure": u.Query().Get("allowInsecure") == "1",
			},
		},
	}
	return outbound, nil
}

func parseSS(link string) (*OutboundConfig, error) {
	u, err := url.Parse(link)
	if err != nil {
		return nil, err
	}

	var method, password, host string
	var port int

	if u.User != nil {
		userInfo := u.User.Username()
		decoded, err := decodeBase64(userInfo)
		if err != nil {
			return nil, fmt.Errorf("SS userInfo base64 decode error: %v", err)
		}
		parts := strings.SplitN(string(decoded), ":", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid SS userInfo format")
		}
		method = parts[0]
		password = parts[1]
		host = u.Hostname()
		portStr := u.Port()
		port, _ = strconv.Atoi(portStr)
	} else {
		b64 := u.Host
		decoded, err := decodeBase64(b64)
		if err != nil {
			return nil, fmt.Errorf("SS path base64 decode error: %v", err)
		}
		str := string(decoded)
		atIndex := strings.LastIndex(str, "@")
		if atIndex == -1 {
			return nil, fmt.Errorf("invalid SS link format (missing @)")
		}
		left := str[:atIndex]
		right := str[atIndex+1:]
		
		userParts := strings.SplitN(left, ":", 2)
		if len(userParts) != 2 {
			return nil, fmt.Errorf("invalid SS userinfo")
		}
		method = userParts[0]
		password = userParts[1]
		
		hostParts := strings.SplitN(right, ":", 2)
		host = hostParts[0]
		if len(hostParts) == 2 {
			port, _ = strconv.Atoi(hostParts[1])
		} else {
			port = 443 
		}
	}

	outbound := &OutboundConfig{
		Protocol: "shadowsocks",
		Settings: map[string]interface{}{
			"servers": []interface{}{
				map[string]interface{}{
					"address":  host,
					"port":     port,
					"method":   method,
					"password": password,
				},
			},
		},
		StreamSettings: &StreamSettings{
			Network: "tcp",
		},
	}
	return outbound, nil
}

func decodeBase64(s string) ([]byte, error) {
	if l := len(s) % 4; l > 0 {
		s += strings.Repeat("=", 4-l)
	}
	data, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return base64.URLEncoding.DecodeString(s)
	}
	return data, nil
}
