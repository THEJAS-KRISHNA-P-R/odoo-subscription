package plans

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Plan struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	PriceMinor    int64     `json:"price_minor"`
	BillingPeriod string    `json:"billing_period"`
	MinQuantity   int       `json:"min_quantity"`
	AvailableFrom string    `json:"available_from"`
	AvailableTo   *string   `json:"available_to"`
	AutoClose     bool      `json:"auto_close"`
	Closable      bool      `json:"closable"`
	Pausable      bool      `json:"pausable"`
	Renewable     bool      `json:"renewable"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ListPlans(ctx context.Context, isActive *bool, cursor int64, limit int) ([]Plan, error) {
	if limit <= 0 {
		limit = 25
	}
	if limit > 100 {
		limit = 100
	}
	if cursor < 0 {
		return nil, fmt.Errorf("cursor must not be negative")
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, price_minor, billing_period, min_quantity,
		       available_from::text, available_to::text, auto_close, closable,
		       pausable, renewable, is_active, created_at
		FROM plans
		WHERE ($1::boolean IS NULL OR is_active = $1)
		  AND ($2::bigint = 0 OR id < $2)
		ORDER BY id DESC
		LIMIT $3`,
		isActive, cursor, limit+1,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	plans := make([]Plan, 0)
	for rows.Next() {
		var plan Plan
		var availableTo sql.NullString
		if err := rows.Scan(
			&plan.ID, &plan.Name, &plan.PriceMinor, &plan.BillingPeriod,
			&plan.MinQuantity, &plan.AvailableFrom, &availableTo, &plan.AutoClose,
			&plan.Closable, &plan.Pausable, &plan.Renewable, &plan.IsActive,
			&plan.CreatedAt,
		); err != nil {
			return nil, err
		}
		if availableTo.Valid {
			plan.AvailableTo = &availableTo.String
		}
		plans = append(plans, plan)
	}
	return plans, rows.Err()
}

func (s *Store) GetPlan(ctx context.Context, id int64) (*Plan, error) {
	var plan Plan
	var availableTo sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, price_minor, billing_period, min_quantity,
		       available_from::text, available_to::text, auto_close, closable,
		       pausable, renewable, is_active, created_at
		FROM plans
		WHERE id = $1`,
		id,
	).Scan(
		&plan.ID, &plan.Name, &plan.PriceMinor, &plan.BillingPeriod,
		&plan.MinQuantity, &plan.AvailableFrom, &availableTo, &plan.AutoClose,
		&plan.Closable, &plan.Pausable, &plan.Renewable, &plan.IsActive,
		&plan.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if availableTo.Valid {
		plan.AvailableTo = &availableTo.String
	}
	return &plan, nil
}

func (s *Store) CreatePlan(ctx context.Context, plan Plan) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO plans (
			name, price_minor, billing_period, min_quantity, available_from,
			available_to, auto_close, closable, pausable, renewable, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id`,
		plan.Name, plan.PriceMinor, plan.BillingPeriod, plan.MinQuantity,
		plan.AvailableFrom, plan.AvailableTo, plan.AutoClose, plan.Closable,
		plan.Pausable, plan.Renewable, plan.IsActive,
	).Scan(&id)
	return id, err
}

func (s *Store) UpdatePlan(ctx context.Context, id int64, name, billingPeriod, availableFrom string, priceMinor *int64, minQuantity *int, availableTo *string, autoClose, closable, pausable, renewable, isActive *bool) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE plans
		SET name = COALESCE(NULLIF($1, ''), name),
		    price_minor = COALESCE($2, price_minor),
		    billing_period = COALESCE(NULLIF($3, '')::period_t, billing_period),
		    min_quantity = COALESCE($4, min_quantity),
		    available_from = COALESCE(NULLIF($5, '')::date, available_from),
		    available_to = COALESCE($6::date, available_to),
		    auto_close = COALESCE($7, auto_close),
		    closable = COALESCE($8, closable),
		    pausable = COALESCE($9, pausable),
		    renewable = COALESCE($10, renewable),
		    is_active = COALESCE($11, is_active)
		WHERE id = $12`,
		name, priceMinor, billingPeriod, minQuantity, availableFrom, availableTo,
		autoClose, closable, pausable, renewable, isActive, id,
	)
	if err != nil {
		return err
	}
	if count, err := result.RowsAffected(); err != nil {
		return err
	} else if count == 0 {
		return sql.ErrNoRows
	}
	return nil
}
