package customers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Customer is a billing account. The login email lives on the linked user row.
type Customer struct {
	ID             int64     `json:"id"`
	UserID         *int64    `json:"-"`
	Name           string    `json:"name"`
	Company        string    `json:"company"`
	Phone          string    `json:"phone"`
	BillingAddress string    `json:"billing_address"`
	Email          string    `json:"email"`
	CreatedAt      time.Time `json:"created_at"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

const selectCustomer = `
	SELECT c.id, c.user_id, c.name, COALESCE(c.company, ''), COALESCE(c.phone, ''),
	       COALESCE(c.billing_address, ''), COALESCE(u.email::text, ''), c.created_at
	FROM customers c
	LEFT JOIN users u ON u.id = c.user_id`

func (s *Store) List(ctx context.Context, q string, cursor int64, limit int) ([]Customer, error) {
	rows, err := s.db.QueryContext(ctx, selectCustomer+`
		WHERE ($1 = ''
		       OR c.name ILIKE '%' || $1 || '%'
		       OR COALESCE(c.company, '') ILIKE '%' || $1 || '%'
		       OR COALESCE(u.email::text, '') ILIKE '%' || $1 || '%')
		  AND ($2::bigint = 0 OR c.id < $2)
		ORDER BY c.id DESC
		LIMIT $3`,
		q, cursor, limit+1,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Customer, 0, limit)
	for rows.Next() {
		c, scanErr := scanCustomer(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		list = append(list, *c)
	}
	return list, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (*Customer, error) {
	c, err := scanCustomer(s.db.QueryRowContext(ctx, selectCustomer+` WHERE c.id = $1`, id))
	return c, err
}

func scanCustomer(row interface{ Scan(...any) error }) (*Customer, error) {
	var c Customer
	if err := row.Scan(&c.ID, &c.UserID, &c.Name, &c.Company, &c.Phone, &c.BillingAddress, &c.Email, &c.CreatedAt); err != nil {
		return nil, err
	}
	return &c, nil
}

// Create inserts the optional login (users row) and the customer in one transaction.
func (s *Store) Create(ctx context.Context, name, email, company, phone, address string) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	userID, err := ensureUser(ctx, tx, email, name)
	if err != nil {
		return 0, err
	}

	var id int64
	err = tx.QueryRowContext(ctx,
		`INSERT INTO customers (user_id, name, company, phone, billing_address)
		 VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''))
		 RETURNING id`,
		userID, name, company, phone, address,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, tx.Commit()
}

func (s *Store) Update(ctx context.Context, id int64, name, email, company, phone, address string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var userID *int64
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM customers WHERE id = $1 FOR UPDATE`, id).
		Scan(&userID); err != nil {
		return err
	}

	if email != "" {
		if userID != nil {
			if _, err := tx.ExecContext(ctx, `UPDATE users SET email = $1 WHERE id = $2`, email, *userID); err != nil {
				return err
			}
		} else {
			newUser, err := ensureUser(ctx, tx, email, name)
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `UPDATE customers SET user_id = $1 WHERE id = $2`, newUser, id); err != nil {
				return err
			}
		}
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE customers
		 SET name = $2, company = NULLIF($3, ''), phone = NULLIF($4, ''), billing_address = NULLIF($5, '')
		 WHERE id = $1`,
		id, name, company, phone, address,
	); err != nil {
		return err
	}
	return tx.Commit()
}

// ensureUser creates a customer login with a random unusable password so the account can
// be reached later through the password-reset flow. Existing emails are reused.
func ensureUser(ctx context.Context, tx *sql.Tx, email, name string) (*int64, error) {
	if email == "" {
		return nil, nil
	}
	var id int64
	err := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email = $1`, email).Scan(&id)
	if err == nil {
		return &id, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(hex.EncodeToString(raw)), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'customer') RETURNING id`,
		email, string(hash), name,
	).Scan(&id); err != nil {
		return nil, err
	}
	return &id, nil
}
