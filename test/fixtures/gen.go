// Generates JSON fixtures for the qr-backup migration parser tests.
// Run via the wrapper script described in test/fixtures/README.md.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/dim13/otpauth/migration"
	"google.golang.org/protobuf/proto"
)

type fixture struct {
	Description string   `json:"description"`
	Input       string   `json:"input"`
	Expected    []string `json:"expected"`
}

type account struct {
	Type   migration.Payload_OtpParameters_OtpType
	Name   string
	Issuer string
	Secret []byte
}

func build(desc string, accounts []account) fixture {
	payload := &migration.Payload{Version: 1, BatchSize: 1, BatchIndex: 0}
	for _, a := range accounts {
		payload.OtpParameters = append(payload.OtpParameters, &migration.Payload_OtpParameters{
			Secret: a.Secret,
			Name:   a.Name,
			Issuer: a.Issuer,
			Type:   a.Type,
		})
	}
	data, err := proto.Marshal(payload)
	if err != nil {
		panic(err)
	}
	u := migration.URL(data)
	expected := make([]string, 0, len(payload.OtpParameters))
	for _, op := range payload.OtpParameters {
		expected = append(expected, op.URL().String())
	}
	return fixture{Description: desc, Input: u.String(), Expected: expected}
}

func write(path string, f fixture) {
	out, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		panic(err)
	}
	out = append(out, '\n')
	if err := os.WriteFile(path, out, 0644); err != nil {
		panic(err)
	}
	fmt.Println("wrote", path)
}

func main() {
	totp := migration.Payload_OtpParameters_OTP_TYPE_TOTP

	secretA := []byte("HelloWorld")
	secretB := []byte("0123456789")
	secretC := []byte{0x48, 0x65, 0x6c, 0x6c, 0x6f}

	write("migration-single.json", build(
		"Single synthetic TOTP account with issuer.",
		[]account{{Type: totp, Name: "Test:user1@test", Issuer: "Test", Secret: secretA}},
	))

	write("migration-multi.json", build(
		"Three synthetic TOTP accounts with mixed issuers.",
		[]account{
			{Type: totp, Name: "Test:user1@test", Issuer: "Test", Secret: secretA},
			{Type: totp, Name: "Test:user2@test", Issuer: "Test", Secret: secretB},
			{Type: totp, Name: "Other:user3@test", Issuer: "Other", Secret: secretC},
		},
	))

	write("migration-no-issuer.json", build(
		"Synthetic account with no issuer field.",
		[]account{{Type: totp, Name: "user-without-issuer", Secret: secretA}},
	))

	write("migration-encoded-label.json", build(
		"Synthetic account whose label and issuer contain characters that must be URL-encoded.",
		[]account{{Type: totp, Name: "Acme Corp:user@acme.example", Issuer: "Acme Corp", Secret: secretA}},
	))
}
