package templates

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"brightloop/internal/subscriptions"
)

type TemplateLine struct {
	ProductID    int64  `json:"product_id"`
	ProductName  string `json:"product_name"`
	VariantID    *int64 `json:"variant_id"`
	VariantLabel string `json:"variant_label"`
	Quantity     int    `json:"quantity"`
}

type Template struct {
	ID           int64          `json:"id"`
	Name         string         `json:"name"`
	PlanID       int64          `json:"plan_id"`
	PlanName     string         `json:"plan_name"`
	ValidityDays int            `json:"validity_days"`
	Lines        []TemplateLine `json:"lines"`
}

type Store struct {
	db       *sql.DB
	subStore *subscriptions.Store
}

func NewStore(db *sql.DB, subStore *subscriptions.Store) *Store {
	return &Store{db: db, subStore: subStore}
}

func (s *Store) List(ctx context.Context, cursor int64, limit int) ([]Template, error) {
	where := ""
	args := []any{limit + 1}
	if cursor > 0 {
		where = "WHERE t.id < $2"
		args = []any{limit + 1, cursor}
	}

	query := fmt.Sprintf(`
		SELECT t.id, t.name, t.plan_id, p.name, t.validity_days
		FROM quotation_templates t
		JOIN plans p ON t.plan_id = p.id
		%s
		ORDER BY t.id DESC
		LIMIT $1`, where)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Template
	for rows.Next() {
		var t Template
		if err := rows.Scan(&t.ID, &t.Name, &t.PlanID, &t.PlanName, &t.ValidityDays); err != nil {
			return nil, err
		}
		t.Lines = []TemplateLine{}
		items = append(items, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range items {
		lines, err := s.getLines(ctx, items[i].ID)
		if err != nil {
			return nil, err
		}
		items[i].Lines = lines
	}

	return items, nil
}

func (s *Store) Get(ctx context.Context, id int64) (*Template, error) {
	query := `
		SELECT t.id, t.name, t.plan_id, p.name, t.validity_days
		FROM quotation_templates t
		JOIN plans p ON t.plan_id = p.id
		WHERE t.id = $1`

	var t Template
	if err := s.db.QueryRowContext(ctx, query, id).Scan(&t.ID, &t.Name, &t.PlanID, &t.PlanName, &t.ValidityDays); err != nil {
		return nil, err
	}

	lines, err := s.getLines(ctx, t.ID)
	if err != nil {
		return nil, err
	}
	t.Lines = lines
	return &t, nil
}

func (s *Store) getLines(ctx context.Context, templateID int64) ([]TemplateLine, error) {
	query := `
		SELECT qtl.product_id, p.name, qtl.variant_id, COALESCE(pv.value, ''), qtl.quantity
		FROM quotation_template_lines qtl
		JOIN products p ON qtl.product_id = p.id
		LEFT JOIN product_variants pv ON qtl.variant_id = pv.id
		WHERE qtl.template_id = $1
		ORDER BY qtl.id`

	rows, err := s.db.QueryContext(ctx, query, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lines []TemplateLine
	for rows.Next() {
		var l TemplateLine
		if err := rows.Scan(&l.ProductID, &l.ProductName, &l.VariantID, &l.VariantLabel, &l.Quantity); err != nil {
			return nil, err
		}
		lines = append(lines, l)
	}
	return lines, rows.Err()
}

func (s *Store) Create(ctx context.Context, name string, planID int64, validityDays int, lines []TemplateLine) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var id int64
	query := `
		INSERT INTO quotation_templates (name, plan_id, validity_days)
		VALUES ($1, $2, $3)
		RETURNING id`
	if err := tx.QueryRowContext(ctx, query, name, planID, validityDays).Scan(&id); err != nil {
		return 0, err
	}

	for _, l := range lines {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO quotation_template_lines (template_id, product_id, variant_id, quantity)
			VALUES ($1, $2, $3, $4)`, id, l.ProductID, l.VariantID, l.Quantity); err != nil {
			return 0, err
		}
	}

	return id, tx.Commit()
}

func (s *Store) Update(ctx context.Context, id int64, name string, planID int64, validityDays int, lines []TemplateLine) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		UPDATE quotation_templates
		SET name = $1, plan_id = $2, validity_days = $3
		WHERE id = $4`
	res, err := tx.ExecContext(ctx, query, name, planID, validityDays, id)
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

	if _, err := tx.ExecContext(ctx, `DELETE FROM quotation_template_lines WHERE template_id = $1`, id); err != nil {
		return err
	}

	for _, l := range lines {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO quotation_template_lines (template_id, product_id, variant_id, quantity)
			VALUES ($1, $2, $3, $4)`, id, l.ProductID, l.VariantID, l.Quantity); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) Instantiate(ctx context.Context, templateID, customerID, userID int64) (*subscriptions.Subscription, error) {
	tpl, err := s.Get(ctx, templateID)
	if err != nil {
		return nil, err
	}

	// Fetch default payment term
	var paymentTermID int64
	err = s.db.QueryRowContext(ctx, `SELECT id FROM payment_terms ORDER BY id LIMIT 1`).Scan(&paymentTermID)
	if err != nil {
		return nil, fmt.Errorf("no payment term found: %w", err)
	}

	// Fetch plan details
	var planPriceMinor int64
	var billingPeriod string
	if err := s.db.QueryRowContext(ctx, `SELECT price_minor, billing_period FROM plans WHERE id = $1`, tpl.PlanID).
		Scan(&planPriceMinor, &billingPeriod); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	startDate := now.Format("2006-01-02")
	expiryDate := now.AddDate(1, 0, 0).Format("2006-01-02")
	quoteValidUntil := now.AddDate(0, 0, tpl.ValidityDays).Format("2006-01-02")

	subLines := []subscriptions.LineInput{}

	// Plan line (product_id = nil)
	subLines = append(subLines, subscriptions.LineInput{
		ProductID:      nil,
		VariantID:      nil,
		Description:    tpl.PlanName + " Subscription Fee",
		Quantity:       1,
		UnitPriceMinor: planPriceMinor,
		TaxID:          nil,
	})

	for _, tl := range tpl.Lines {
		var salesPriceMinor int64
		var taxID *int64
		var pName string
		err := s.db.QueryRowContext(ctx, `SELECT name, sales_price_minor, tax_id FROM products WHERE id = $1`, tl.ProductID).
			Scan(&pName, &salesPriceMinor, &taxID)
		if err != nil {
			return nil, err
		}

		unitPrice := salesPriceMinor
		desc := pName
		if tl.VariantID != nil {
			var extraPrice int64
			var vVal string
			if err := s.db.QueryRowContext(ctx, `SELECT extra_price_minor, value FROM product_variants WHERE id = $1`, *tl.VariantID).
				Scan(&extraPrice, &vVal); err == nil {
				unitPrice += extraPrice
				desc += " (" + vVal + ")"
			}
		}

		pid := tl.ProductID
		subLines = append(subLines, subscriptions.LineInput{
			ProductID:      &pid,
			VariantID:      tl.VariantID,
			Description:    desc,
			Quantity:       tl.Quantity,
			UnitPriceMinor: unitPrice,
			TaxID:          taxID,
		})
	}

	tplID := templateID
	subID, err := s.subStore.Create(
		ctx,
		customerID,
		tpl.PlanID,
		paymentTermID,
		userID,
		&tplID,
		startDate,
		expiryDate,
		&quoteValidUntil,
		subLines,
	)
	if err != nil {
		return nil, err
	}

	return s.subStore.Get(ctx, subID)
}
