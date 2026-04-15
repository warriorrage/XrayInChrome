package messaging

import (
	"encoding/binary"
	"encoding/json"
	"io"
)

// Message represents the communication format between the Chrome extension and the native host.
type Message struct {
	Action    string      `json:"action"`
	Content   interface{} `json:"content,omitempty"`
	Type      string      `json:"type,omitempty"`
	SocksPort int         `json:"socksPort,omitempty"`
	HttpPort  int         `json:"httpPort,omitempty"`
}

// ReadMessage reads a length-prefixed JSON message from the provided reader.
func ReadMessage(r io.Reader) (*Message, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		return nil, err
	}
	msgBytes := make([]byte, length)
	if _, err := io.ReadFull(r, msgBytes); err != nil {
		return nil, err
	}
	var msg Message
	if err := json.Unmarshal(msgBytes, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

// SendMessage writes a length-prefixed JSON message to the provided writer.
func SendMessage(w io.Writer, msg Message) error {
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint32(len(msgBytes))); err != nil {
		return err
	}
	_, err = w.Write(msgBytes)
	return err
}
