package auth

import (
	"database/sql"
	"net/http"
	"time"

	"brightloop/backend/internal/httpx"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// CreateUser inserts a user with the given details. Returns the user ID.
func (s *Store) CreateUser(email, passwordHash, fullName string, role string) (int, error) {
	var id int
	err := s.db.QueryRow(
		`INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
		email, passwordHash, fullName, role,
	).Scan(&id)
	return id, err
}

// GetUserByEmail finds a user by email
func (s *Store) GetUserByEmail(email string) (*User, error) {
	var u User
	err := s.db.QueryRow(`SELECT id, email, password_hash, full_name, role, is_active, created_at FROM users WHERE email = $1`, email).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// User represents a user in the system
type User struct {
	ID        int
	Email     string
	PasswordHash string
	FullName  string
	Role      string
	IsActive  bool
	CreatedAt time.Time
}