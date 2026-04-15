package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"time"
)

type Message struct {
	Action    string      `json:"action"`
	Content   interface{} `json:"content,omitempty"`
	Type      string      `json:"type,omitempty"`
	SocksPort int         `json:"socksPort,omitempty"`
	HttpPort  int         `json:"httpPort,omitempty"`
}

func sendMessage(w io.Writer, msg Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	length := uint32(len(data))
	if err := binary.Write(w, binary.LittleEndian, length); err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}

func readMessage(r io.Reader) (string, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return "", err
	}
	data := make([]byte, length)
	if _, err := io.ReadFull(r, data); err != nil {
		return "", err
	}
	return string(data), nil
}

func main() {
	exePath := "./xray-bridge-debug.exe"
	fmt.Println("Starting test client...")
	fmt.Println("Connecting to:", exePath)

	cmd := exec.Command(exePath)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		panic(err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		panic(err)
	}

	if err := cmd.Start(); err != nil {
		fmt.Println("Failed to start bridge:", err)
		return
	}

	go func() {
		for {
			msg, err := readMessage(stdout)
			if err != nil {
				if err != io.EOF {
					fmt.Println("Read Error:", err)
				}
				break
			}
			fmt.Println("Bridge:", msg)
		}
	}()

	tests := []struct {
		name string
		msg  Message
		wait time.Duration
	}{
		{"Ping Test", Message{Action: "ping"}, 500 * time.Millisecond},
		{"Health Check", Message{Action: "check"}, 1 * time.Second},
		{"Start Xray", Message{Action: "start", Content: "vless://uuid@127.0.0.1:443?security=reality&sni=example.com&fp=chrome&pbk=S6T8vXmZ8zC8zP9Y5zR8uK1wX2zC8zP9Y5zR8uK1wX2z=&sid=id"}, 2 * time.Second},
		{"Status Check", Message{Action: "status"}, 500 * time.Millisecond},
		{"Stop Xray", Message{Action: "stop"}, 1 * time.Second},
		{"Final Status", Message{Action: "status"}, 500 * time.Millisecond},
	}

	for _, tc := range tests {
		fmt.Println("---")
		fmt.Println("Testing:", tc.name)
		if err := sendMessage(stdin, tc.msg); err != nil {
			fmt.Println("Send error:", err)
			break
		}
		time.Sleep(tc.wait)
	}
	
	// DEBUG: Print the last generated config file
	// Since we don't know the exact ID, we can't easily find the file here.
	// But we can modify the bridge to print the config path.
	fmt.Println("Test sequence completed. Killing bridge...")
	cmd.Process.Kill()
}
