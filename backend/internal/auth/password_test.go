package auth

import "testing"

func TestValidatePassword(t *testing.T) {
	cases := map[string]bool{ // password -> ok
		"Abcdef1!":   false, // exactly 8: "more than eight" fails
		"Abcdefg1!":  true,  // 9
		"abcdefgh1!": false, // no uppercase
		"ABCDEFGH1!": false, // no lowercase
		"Abcdefgh12": false, // no special
		"Abcdefgh!!": true,
		"":           false,
	}
	for p, ok := range cases {
		if got := ValidatePassword(p) == ""; got != ok {
			t.Errorf("%q: got ok=%v want %v (%q)", p, got, ok, ValidatePassword(p))
		}
	}
}
