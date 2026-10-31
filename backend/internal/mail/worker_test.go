package mail

import (
	"strings"
	"testing"
)

func TestMimeMessageIncludesHeadersAndBody(t *testing.T) {
	got := mimeMessage("no-reply@brightloop.io", message{
		to:      "person@example.com",
		subject: "Reset your Brightloop password",
		body:    "https://example.com/reset?token=abc",
	})

	for _, want := range []string{
		"From: no-reply@brightloop.io",
		"To: person@example.com",
		"Subject: Reset your Brightloop password",
		"Content-Type: text/plain; charset=UTF-8",
		"https://example.com/reset?token=abc",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("mime message missing %q: %s", want, got)
		}
	}
}
