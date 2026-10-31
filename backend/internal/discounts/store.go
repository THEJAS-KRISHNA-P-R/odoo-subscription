package discounts

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

type Discount struct {
	ID               int64   `json:"id"`
	Name             string  `json:"name"`
	Kind             string  `json:"kind"`
	Value            int64   `json:"value"`
	MinPurchaseMinor int64   `json:"min_purchase_minor"`
	MinQuantity      int     `json:"min_quantity"`
	StartDate        string  `json:"start_date"`
	EndDate          string  `json:"end_date"`
	UsageLimit       *int    `json:"usage_limit"`
	UsedCount        int     `json:"used_count"`
	Scope            string  `json:"scope"`
	IsActive         bool    `json:"is_active"`
	ProductIDs       []int64 `json:"product_ids"`
	SubscriptionIDs  []int64 `json:"subscription_ids"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List(ctx context.Context, cursor int64, limit int) ([]Discount, error) {
	where := ""
	args := []any{limit + 1}
	if cursor > 0 {
		where = "WHERE d.id < $2"
		args = []any{limit + 1, cursor}
	}

	query := fmt.Sprintf(`
		SELECT d.id, d.name, d.kind, d.value, d.min_purchase_minor, d.min_quantity,
		       to_char(d.start_date, 'YYYY-MM-DD'), to_char(d.end_date, 'YYYY-MM-DD'),
		       d.usage_limit, d.used_count, d.scope, d.is_active,
		       array_to_json(COALESCE(array_remove(array_agg(DISTINCT dp.product_id), NULL), '{}'))::text AS product_ids,
		       array_to_json(COALESCE(array_remove(array_agg(DISTINCT ds.subscription_id), NULL), '{}'))::text AS subscription_ids
		FROM discounts d
		LEFT JOIN discount_products dp ON d.id = dp.discount_id
		LEFT JOIN discount_subscriptions ds ON d.id = ds.discount_id
		%s
		GROUP BY d.id
		ORDER BY d.id DESC
		LIMIT $1`, where)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Discount
	for rows.Next() {
		var item Discount
		var pidsRaw, sidsRaw string
		if err := rows.Scan(
			&item.ID, &item.Name, &item.Kind, &item.Value,
			&item.MinPurchaseMinor, &item.MinQuantity,
			&item.StartDate, &item.EndDate,
			&item.UsageLimit, &item.UsedCount, &item.Scope, &item.IsActive,
			&pidsRaw, &sidsRaw,
		); err != nil {
			return nil, err
		}
		item.ProductIDs, err = parseIDArray(pidsRaw)
		if err != nil {
			return nil, fmt.Errorf("parse product ids: %w", err)
		}
		item.SubscriptionIDs, err = parseIDArray(sidsRaw)
		if err != nil {
			return nil, fmt.Errorf("parse subscription ids: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (*Discount, error) {
	query := `
		SELECT d.id, d.name, d.kind, d.value, d.min_purchase_minor, d.min_quantity,
		       to_char(d.start_date, 'YYYY-MM-DD'), to_char(d.end_date, 'YYYY-MM-DD'),
		       d.usage_limit, d.used_count, d.scope, d.is_active,
		       array_to_json(COALESCE(array_remove(array_agg(DISTINCT dp.product_id), NULL), '{}'))::text AS product_ids,
		       array_to_json(COALESCE(array_remove(array_agg(DISTINCT ds.subscription_id), NULL), '{}'))::text AS subscription_ids
		FROM discounts d
		LEFT JOIN discount_products dp ON d.id = dp.discount_id
		LEFT JOIN discount_subscriptions ds ON d.id = ds.discount_id
		WHERE d.id = $1
		GROUP BY d.id`

	var item Discount
	var pidsRaw, sidsRaw string
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&item.ID, &item.Name, &item.Kind, &item.Value,
		&item.MinPurchaseMinor, &item.MinQuantity,
		&item.StartDate, &item.EndDate,
		&item.UsageLimit, &item.UsedCount, &item.Scope, &item.IsActive,
		&pidsRaw, &sidsRaw,
	)
	if err != nil {
		return nil, err
	}
	item.ProductIDs, err = parseIDArray(pidsRaw)
	if err != nil {
		return nil, fmt.Errorf("parse product ids: %w", err)
	}
	item.SubscriptionIDs, err = parseIDArray(sidsRaw)
	if err != nil {
		return nil, fmt.Errorf("parse subscription ids: %w", err)
	}
	return &item, nil
}

func parseIDArray(raw string) ([]int64, error) {
	var ids []int64
	if err := json.Unmarshal([]byte(raw), &ids); err != nil {
		return nil, err
	}
	if ids == nil {
		return []int64{}, nil
	}
	return ids, nil
}

func (s *Store) Create(ctx context.Context, name, kind string, value, minPurchaseMinor int64, minQuantity int, startDate, endDate string, usageLimit *int, scope string, isActive bool, productIDs, subscriptionIDs []int64) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var id int64
	query := `
		INSERT INTO discounts (name, kind, value, min_purchase_minor, min_quantity, start_date, end_date, usage_limit, scope, is_active)
		VALUES ($1, $2::disc_kind_t, $3, $4, $5, $6::date, $7::date, $8, $9::disc_scope_t, $10)
		RETURNING id`
	if err := tx.QueryRowContext(ctx, query, name, kind, value, minPurchaseMinor, minQuantity, startDate, endDate, usageLimit, scope, isActive).Scan(&id); err != nil {
		return 0, err
	}

	for _, pid := range productIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO discount_products (discount_id, product_id) VALUES ($1, $2)`, id, pid); err != nil {
			return 0, err
		}
	}

	for _, sid := range subscriptionIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO discount_subscriptions (discount_id, subscription_id) VALUES ($1, $2)`, id, sid); err != nil {
			return 0, err
		}
	}

	return id, tx.Commit()
}

func (s *Store) Update(ctx context.Context, id int64, name, kind string, value, minPurchaseMinor int64, minQuantity int, startDate, endDate string, usageLimit *int, scope string, isActive bool, productIDs, subscriptionIDs []int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		UPDATE discounts
		SET name = $1, kind = $2::disc_kind_t, value = $3, min_purchase_minor = $4,
		    min_quantity = $5, start_date = $6::date, end_date = $7::date,
		    usage_limit = $8, scope = $9::disc_scope_t, is_active = $10
		WHERE id = $11`
	res, err := tx.ExecContext(ctx, query, name, kind, value, minPurchaseMinor, minQuantity, startDate, endDate, usageLimit, scope, isActive, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM discount_products WHERE discount_id = $1`, id); err != nil {
		return err
	}
	for _, pid := range productIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO discount_products (discount_id, product_id) VALUES ($1, $2)`, id, pid); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM discount_subscriptions WHERE discount_id = $1`, id); err != nil {
		return err
	}
	for _, sid := range subscriptionIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO discount_subscriptions (discount_id, subscription_id) VALUES ($1, $2)`, id, sid); err != nil {
			return err
		}
	}

	return tx.Commit()
}
