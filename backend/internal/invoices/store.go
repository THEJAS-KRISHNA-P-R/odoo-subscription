package invoices

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Invoice is the full invoice record returned by GET /invoices/{id}.
type Invoice struct {
	ID                 int64         `json:"id"`
	Number             string        `json:"number"`
	SubscriptionID     int64         `json:"subscription_id"`
	SubscriptionNumber string        `json:"subscription_number"`
	CustomerID         int64         `json:"customer_id"`
	CustomerName       string        `json:"customer_name"`
	Status             string        `json:"status"`
	IsOverdue          bool          `json:"is_overdue"`
	PeriodStart        string        `json:"period_start"`
	PeriodEnd          string        `json:"period_end"`
	IssueDate          string        `json:"issue_date"`
	DueDate            string        `json:"due_date"`
	SubtotalMinor      int64         `json:"subtotal_minor"`
	DiscountMinor      int64         `json:"discount_minor"`
	TaxMinor           int64         `json:"tax_minor"`
	TotalMinor         int64         `json:"total_minor"`
	PaidMinor          int64         `json:"paid_minor"`
	OutstandingMinor   int64         `json:"outstanding_minor"`
	SentAt             *time.Time    `json:"sent_at"`
	Lines              []InvoiceLine `json:"lines,omitempty"`
	Payments           []InvPayment  `json:"payments,omitempty"`
}

// InvoiceLine is one line of an invoice.
type InvoiceLine struct {
	Description    string `json:"description"`
	Quantity       int    `json:"quantity"`
	UnitPriceMinor int64  `json:"unit_price_minor"`
	DiscountMinor  int64  `json:"discount_minor"`
	TaxRateBP      int    `json:"tax_rate_bp"`
	TaxMinor       int64  `json:"tax_minor"`
	AmountMinor    int64  `json:"amount_minor"`
}

// InvPayment is a payment entry embedded in an invoice detail.
type InvPayment struct {
	ID          int64  `json:"id"`
	Method      string `json:"method"`
	AmountMinor int64  `json:"amount_minor"`
	PaidOn      string `json:"paid_on"`
	Note        string `json:"note"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store { return &Store{db: db} }

func (s *Store) CustomerIDByUserID(ctx context.Context, userID int64) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx, `SELECT id FROM customers WHERE user_id = $1`, userID).Scan(&id)
	return id, err
}

const selectInv = `
    SELECT i.id, i.number, i.subscription_id, COALESCE(s.number,''), i.customer_id, c.name,
           i.status,
           (i.status = 'confirmed' AND i.paid_minor < i.total_minor AND i.due_date < CURRENT_DATE) AS is_overdue,
           i.period_start::text, i.period_end::text, i.issue_date::text, i.due_date::text,
           i.subtotal_minor, i.discount_minor, i.tax_minor, i.total_minor, i.paid_minor,
           (i.total_minor - i.paid_minor) AS outstanding_minor,
           i.sent_at
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN subscriptions s ON s.id = i.subscription_id`

func scanInv(row interface{ Scan(...any) error }) (*Invoice, error) {
	var inv Invoice
	if err := row.Scan(
		&inv.ID, &inv.Number, &inv.SubscriptionID, &inv.SubscriptionNumber,
		&inv.CustomerID, &inv.CustomerName, &inv.Status, &inv.IsOverdue,
		&inv.PeriodStart, &inv.PeriodEnd, &inv.IssueDate, &inv.DueDate,
		&inv.SubtotalMinor, &inv.DiscountMinor, &inv.TaxMinor, &inv.TotalMinor,
		&inv.PaidMinor, &inv.OutstandingMinor, &inv.SentAt,
	); err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *Store) List(ctx context.Context, status string, overdueOnly bool, customerID string, cursor int64, limit int) ([]Invoice, error) {
	rows, err := s.db.QueryContext(ctx, selectInv+`
        WHERE ($1 = '' OR i.status::text = $1)
          AND (NOT $2 OR (i.status = 'confirmed' AND i.paid_minor < i.total_minor AND i.due_date < CURRENT_DATE))
          AND ($3 = '' OR i.customer_id = $3::bigint)
          AND ($4::bigint = 0 OR i.id < $4)
        ORDER BY i.id DESC LIMIT $5`,
		status, overdueOnly, customerID, cursor, limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]Invoice, 0)
	for rows.Next() {
		inv, err := scanInv(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *inv)
	}
	return list, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (*Invoice, error) {
	inv, err := scanInv(s.db.QueryRowContext(ctx, selectInv+` WHERE i.id = $1`, id))
	if err != nil {
		return nil, err
	}
	// load lines
	rows, err := s.db.QueryContext(ctx, `
        SELECT description, quantity, unit_price_minor, discount_minor, tax_rate_bp, tax_minor, amount_minor
        FROM invoice_lines WHERE invoice_id = $1 ORDER BY id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	inv.Lines = make([]InvoiceLine, 0)
	for rows.Next() {
		var l InvoiceLine
		if err := rows.Scan(&l.Description, &l.Quantity, &l.UnitPriceMinor,
			&l.DiscountMinor, &l.TaxRateBP, &l.TaxMinor, &l.AmountMinor); err != nil {
			return nil, err
		}
		inv.Lines = append(inv.Lines, l)
	}
	// load payments
	prows, err := s.db.QueryContext(ctx, `
        SELECT id, method, amount_minor, paid_on::text, COALESCE(note,'')
        FROM payments WHERE invoice_id = $1 ORDER BY id`, id)
	if err != nil {
		return nil, err
	}
	defer prows.Close()
	inv.Payments = make([]InvPayment, 0)
	for prows.Next() {
		var p InvPayment
		if err := prows.Scan(&p.ID, &p.Method, &p.AmountMinor, &p.PaidOn, &p.Note); err != nil {
			return nil, err
		}
		inv.Payments = append(inv.Payments, p)
	}
	return inv, nil
}

// Confirm moves an invoice from draft → confirmed.
func (s *Store) Confirm(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var status string
	if err := tx.QueryRowContext(ctx, `SELECT status FROM invoices WHERE id = $1 FOR UPDATE`, id).Scan(&status); err != nil {
		return err
	}
	if status != "draft" {
		return fmt.Errorf("invalid_transition")
	}
	_, err = tx.ExecContext(ctx, `UPDATE invoices SET status = 'confirmed' WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// Cancel moves an invoice to cancelled (only when paid_minor = 0).
func (s *Store) Cancel(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var status string
	var paid int64
	if err := tx.QueryRowContext(ctx, `SELECT status, paid_minor FROM invoices WHERE id = $1 FOR UPDATE`, id).
		Scan(&status, &paid); err != nil {
		return err
	}
	if status == "cancelled" || status == "paid" {
		return fmt.Errorf("invalid_transition")
	}
	if paid > 0 {
		return fmt.Errorf("has_payments")
	}
	_, err = tx.ExecContext(ctx, `UPDATE invoices SET status = 'cancelled' WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// Send stamps sent_at (only when confirmed).
func (s *Store) Send(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var status string
	if err := tx.QueryRowContext(ctx, `SELECT status FROM invoices WHERE id = $1 FOR UPDATE`, id).Scan(&status); err != nil {
		return err
	}
	if status != "confirmed" {
		return fmt.Errorf("invalid_transition")
	}
	_, err = tx.ExecContext(ctx, `UPDATE invoices SET sent_at = now() WHERE id = $1 AND sent_at IS NULL`, id)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// RecordPayment adds a payment and advances paid_minor, marks paid when full.
func (s *Store) RecordPayment(ctx context.Context, invID, recordedBy int64, method string, amount int64, paidOn, note string) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var status string
	var total, paid int64
	if err := tx.QueryRowContext(ctx,
		`SELECT status, total_minor, paid_minor FROM invoices WHERE id = $1 FOR UPDATE`, invID).
		Scan(&status, &total, &paid); err != nil {
		return 0, err
	}
	if status != "confirmed" {
		return 0, fmt.Errorf("not_confirmed")
	}
	outstanding := total - paid
	if amount > outstanding {
		return 0, fmt.Errorf("overpay:%d", outstanding)
	}

	var pid int64
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO payments (invoice_id, method, amount_minor, paid_on, note, recorded_by)
         VALUES ($1, $2, $3, $4::date, NULLIF($5,''), $6) RETURNING id`,
		invID, method, amount, paidOn, note, recordedBy).Scan(&pid); err != nil {
		return 0, err
	}

	newPaid := paid + amount
	newStatus := status
	if newPaid >= total {
		newStatus = "paid"
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE invoices SET paid_minor = $2, status = $3 WHERE id = $1`,
		invID, newPaid, newStatus); err != nil {
		return 0, err
	}
	return pid, tx.Commit()
}

// ListCSV returns all confirmed/paid invoices for CSV export (no pagination).
func (s *Store) ListCSV(ctx context.Context) ([]Invoice, error) {
	rows, err := s.db.QueryContext(ctx, selectInv+`
        WHERE i.status IN ('confirmed','paid')
        ORDER BY i.id DESC LIMIT 10000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]Invoice, 0)
	for rows.Next() {
		inv, err := scanInv(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *inv)
	}
	return list, rows.Err()
}
