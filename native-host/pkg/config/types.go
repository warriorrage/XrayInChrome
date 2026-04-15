package config

// XrayConfig represents the top-level Xray configuration.
type XrayConfig struct {
	Log      LogConfig      `json:"log"`
	Inbounds []InboundConfig `json:"inbounds"`
	Outbounds []OutboundConfig `json:"outbounds"`
}

type LogConfig struct {
	LogLevel string `json:"loglevel"`
}

type InboundConfig struct {
	Port     int                    `json:"port"`
	Listen   string                 `json:"listen"`
	Protocol string                 `json:"protocol"`
	Settings map[string]interface{} `json:"settings"`
	Tag      string                 `json:"tag,omitempty"`
}

type OutboundConfig struct {
	Protocol       string                 `json:"protocol"`
	Settings       map[string]interface{} `json:"settings"`
	StreamSettings *StreamSettings        `json:"streamSettings,omitempty"`
	Tag            string                 `json:"tag,omitempty"`
}

type StreamSettings struct {
	Network         string                 `json:"network"`
	Security        string                 `json:"security,omitempty"`
	TlsSettings     map[string]interface{} `json:"tlsSettings,omitempty"`
	RealitySettings map[string]interface{} `json:"realitySettings,omitempty"`
	WsSettings      map[string]interface{} `json:"wsSettings,omitempty"`
	GrpcSettings    map[string]interface{} `json:"grpcSettings,omitempty"`
}
