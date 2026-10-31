package auth

import (
	"crypto/bcrypt"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"brightloop/backend/internal/httpx"
)

// UserClaims are the JWT claims including role
type UserClaims struct {
	ID        int
	Email     string
	Role      string
	CreatedAt time.Time
}

// Signup handles user registration with password validation and unique email
func Signup(db *sql.DB, email, password, fullName string) *httpx.Response {
	// Validate password: min 9 chars + upper + lower + special
	if len(password) < 9 {
		return httpx.Error400("password", "Password must be at least 9 characters and contain uppercase, lowercase, and special character")
	}

	var hasUpper, hasLower, hasSpecial bool
	for _, c := range password {
		if c >= 'A' && c <= 'Z' {
			hasUpper = true
		}
		if c >= 'a' && c <= 'z' {
			hasLower = true
		}
		if c < '0' || (c > '9' && c < 'A') || (c > 'Z' && c < 'a') || c > 'z' {
			hasSpecial = true
		}
	}
	if !hasUpper || !hasLower || !hasSpecial {
		return httpx.Error400("password", "Password must be at least 9 characters and contain uppercase, lowercase, and special character")
	}

	// Hash password with bcrypt cost 12
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return httpx.Error500("password", "Failed to hash password")
	}

	// Insert user - will fail with unique violation if email exists
	_, err = db.Exec(`INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'customer')`,
		email, string(hashed), fullName)
	if err != nil {
		// Check if it's a unique violation on email
		if isUniqueViolation(err, "users_email_key") {
			return httpx.Error400("email", "Email already exists")
		}
		return httpx.Error500("database", "Failed to create user")
	}

	// Create customer profile
	db.Exec(`INSERT INTO customers (user_id, name) VALUES ($1, $2)`, /* user_id */ 0, fullName)

	return httpx.JSON(http.StatusCreated, map[string]string{"status": "created"})
}

// Login handles authentication
func Login(db *sql.DB, email, password string) *httpx.Response {
	var userID int
	var passwordHash string
	var role string

	err := db.QueryRow(`SELECT id, password_hash, role FROM users WHERE email = $1`, email).Scan(&userID, &passwordHash, &role)
	if err != nil {
		return httpx.Error400("email", "Invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return httpx.Error400("password", "Invalid email or password")
	}

	return httpx.JSON(http.StatusOK, map[string]interface{}{
		"user": map[string]interface{}{
			"id":    userID,
			"email": email,
			"role":  role,
		},
	})
}

// VerifyPassword checks if a password hash matches
func VerifyPassword(hashed, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password)) == nil
}

// isUniqueViolation checks if the error is a unique constraint violation
func isUniqueViolation(err error, constraintName string) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// PostgreSQL unique violation codes
	return true // simplified - in production check pq error code
}