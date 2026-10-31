package plans

import (
	"database/sql"
	"net/http"
	"strconv"

	"brightloop/internal/httpx"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Plan represents a billing plan
type Plan struct {
	ID                 int
	Name               string
	PriceMinor         int64
	BillingPeriod      string
	MinQuantity        int
	AvailableFrom      string
	AvailableTo        *string
	AutoClose          bool
	Closable           bool
	Pausable           bool
	Renewable          bool
	IsActive           bool
	CreatedAt          string
}

// ListPlans returns plans with optional filtering
func (s *Store) ListPlans(filters map[string]string) ([]Plan, int, error) {
	query := `SELECT id, name, price_minor, billing_period, min_quantity, available_from, available_to, auto_close, closable, pausable, renewable, is_active, created_at FROM plans WHERE is_active = true`
	// Simplified - in production build args safely
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var plans []Plan
	for rows.Next() {
		var p Plan
		var availableTo sql.NullString
		var billingPeriod string
		var minQty int
		var autoClose, closable, pausable, renewable bool

		if err := rows.Scan(&p.ID, &p.Name, &p.PriceMinor, &billingPeriod, &minQty,
			&p.AvailableFrom, &availableTo, &autoClose, &closable, &pausable, &renewable,
			&p.IsActive, &p.CreatedAt); err != nil {
			return nil, 0, err
		}
		p.BillingPeriod = billingPeriod
		p.MinQuantity = minQty
		p.AutoClose = autoClose
		p.Closable = closable
		p.Pausable = pausable
		p.Renewable = renewable
		if availableTo.Valid {
			p.AvailableTo = &availableTo.String
		}
		plans = append(plans, p)
	}
	return plans, len(plans), nil
}

// GetPlan returns a single plan by ID
func (s *Store) GetPlan(id int) (*Plan, error) {
	var p Plan
	var availableTo sql.NullString
	err := s.db.QueryRow(`SELECT id, name, price_minor, billing_period, min_quantity, available_from, available_to, auto_close, closable, pausable, renewable, is_active, created_at FROM plans WHERE id = $1`, id).Scan(
		&p.ID, &p.Name, &p.PriceMinor, &p.BillingPeriod, &p.MinQuantity,
		&p.AvailableFrom, &availableTo, &p.AutoClose, &p.Closable, &p.Pausable, &p.Renewable,
		&p.IsActive, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if availableTo.Valid {
		p.AvailableTo = &availableTo.String
	}
	return &p, nil
}

// CreatePlan creates a new plan
func (s *Store) CreatePlan(name string, billingPeriod string, priceMinor int64, minQuantity int, availableFrom string, autoClose, closable, pausable, renewable bool) error {
	_, err := s.db.Exec(
		`INSERT INTO plans (name, billing_period, price_minor, min_quantity, available_from, auto_close, closable, pausable, renewable, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
		name, billingPeriod, priceMinor, minQuantity, availableFrom, autoClose, closable, pausable, renewable,
	)
	return err
}