package auth

import "unicode"

// ValidatePassword returns a field message, or "" if the password is acceptable.
// Rule from the brief: MORE than eight characters (so >= 9), with an uppercase letter,
// a lowercase letter and a special character. Same rule must exist client-side.
func ValidatePassword(p string) string {
	if len([]rune(p)) <= 8 {
		return "Password must be more than 8 characters"
	}
	var up, low, special bool
	for _, r := range p {
		switch {
		case unicode.IsUpper(r):
			up = true
		case unicode.IsLower(r):
			low = true
		case !unicode.IsLetter(r) && !unicode.IsDigit(r) && !unicode.IsSpace(r):
			special = true
		}
	}
	switch {
	case !up:
		return "Add an uppercase letter"
	case !low:
		return "Add a lowercase letter"
	case !special:
		return "Add a special character"
	}
	return ""
}
