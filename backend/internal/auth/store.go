package auth

import (
	"context"
	"database/sql"
	"time"
)

// User represents a user account in the system.
type User struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"full_name"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

// Store handles SQL operations for authentication and users.
type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) CreateUserWithCustomer(ctx context.Context, email, passwordHash, fullName, role string) (int64, int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	var userID int64
	err = tx.QueryRowContext(ctx,
		`INSERT INTO users (email, password_hash, full_name, role)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		email, passwordHash, fullName, role,
	).Scan(&userID)
	if err != nil {
		return 0, 0, err
	}

	var customerID int64
	if role == "customer" {
		err = tx.QueryRowContext(ctx,
			`INSERT INTO customers (user_id, name)
			 VALUES ($1, $2)
			 RETURNING id`,
			userID, fullName,
		).Scan(&customerID)
		if err != nil {
			return 0, 0, err
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}
	return userID, customerID, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, full_name, role, is_active, created_at
		 FROM users
		 WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetUserByID(ctx context.Context, id int64) (*User, error) {
	var u User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, full_name, role, is_active, created_at
		 FROM users
		 WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetCustomerIDForUser(ctx context.Context, userID int64) (*int64, error) {
	var custID int64
	err := s.db.QueryRowContext(ctx,
		`SELECT id FROM customers WHERE user_id = $1`, userID,
	).Scan(&custID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &custID, nil
}

func (s *Store) CreatePasswordReset(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time, toEmail, subject, body string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var resetID int64
	if _, err := tx.ExecContext(ctx,
		`UPDATE password_resets SET used_at = now()
		 WHERE user_id = $1 AND used_at IS NULL`, userID,
	); err != nil {
		return err
	}
	err = tx.QueryRowContext(ctx,
		`INSERT INTO password_resets (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		userID, tokenHash, expiresAt,
	).Scan(&resetID)
	if err != nil {
		return err
	}

	// Queue transactional email in outbox within the same transaction
	_, err = tx.ExecContext(ctx,
		`INSERT INTO email_outbox (kind, to_email, subject, body, ref_id)
		 VALUES ('reset', $1, $2, $3, $4)`,
		toEmail, subject, body, resetID,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) ResetPassword(ctx context.Context, tokenHash, newPasswordHash string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var resetID int64
	var userID int64
	err = tx.QueryRowContext(ctx,
		`SELECT id, user_id FROM password_resets
		 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
		 FOR UPDATE`,
		tokenHash,
	).Scan(&resetID, &userID)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE users SET password_hash = $1 WHERE id = $2`,
		newPasswordHash, userID,
	)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE password_resets SET used_at = now() WHERE id = $1`,
		resetID,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) ListStaff(ctx context.Context) ([]User, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, email, full_name, role, is_active, created_at
		 FROM users
		 WHERE role IN ('admin', 'staff')
		 ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var staff []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt); err != nil {
			return nil, err
		}
		staff = append(staff, u)
	}
	return staff, rows.Err()
}

func (s *Store) CreateStaff(ctx context.Context, email, passwordHash, fullName, role string) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO users (email, password_hash, full_name, role)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		email, passwordHash, fullName, role,
	).Scan(&id)
	return id, err
}

func (s *Store) UpdateStaff(ctx context.Context, id int64, fullName, role string, isActive *bool) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users
		 SET full_name = COALESCE(NULLIF($1, ''), full_name),
		     role = COALESCE(NULLIF($2, '')::role_t, role),
		     is_active = COALESCE($3, is_active)
		 WHERE id = $4 AND role IN ('admin', 'staff')`,
		fullName, role, isActive, id,
	)
	return err
}
