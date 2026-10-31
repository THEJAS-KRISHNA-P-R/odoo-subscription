package reports

import (
	"context"
	"database/sql"
	"time"
)

type InvoiceCounts struct {
	Draft     int `json:"draft"`
	Confirmed int `json:"confirmed"`
	Paid      int `json:"paid"`
	Cancelled int `json:"cancelled"`
}

type SummaryReport struct {
	ActiveSubscriptions int           `json:"active_subscriptions"`
	RevenueMinor        int64         `json:"revenue_minor"`
	OutstandingMinor    int64         `json:"outstanding_minor"`
	OverdueCount        int           `json:"overdue_count"`
	OverdueMinor        int64         `json:"overdue_minor"`
	Invoices            InvoiceCounts `json:"invoices"`
}

type MonthlyRevenue struct {
	Month        string `json:"month"`
	RevenueMinor int64  `json:"revenue_minor"`
}

type OverdueInvoice struct {
	InvoiceID        int64  `json:"invoice_id"`
	Number           string `json:"number"`
	CustomerName     string `json:"customer_name"`
	DueDate          string `json:"due_date"`
	DaysLate         int    `json:"days_late"`
	OutstandingMinor int64  `json:"outstanding_minor"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Summary(ctx context.Context, from, to string) (*SummaryReport, error) {
	if from == "" || to == "" {
		now := time.Now().UTC()
		first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		last := first.AddDate(0, 1, -1)
		from = first.Format("2006-01-02")
		to = last.Format("2006-01-02")
	}

	var rep SummaryReport

	// active subscriptions
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`).Scan(&rep.ActiveSubscriptions); err != nil {
		return nil, err
	}

	// revenue in range
	if err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount_minor), 0)
		FROM payments
		WHERE paid_on >= $1::date AND paid_on <= $2::date`, from, to).Scan(&rep.RevenueMinor); err != nil {
		return nil, err
	}

	// outstanding (all confirmed invoices not fully paid)
	if err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(total_minor - paid_minor), 0)
		FROM invoices
		WHERE status = 'confirmed' AND paid_minor < total_minor`).Scan(&rep.OutstandingMinor); err != nil {
		return nil, err
	}

	// overdue
	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_minor - paid_minor), 0)
		FROM invoices
		WHERE status = 'confirmed' AND due_date < CURRENT_DATE AND paid_minor < total_minor`).Scan(&rep.OverdueCount, &rep.OverdueMinor); err != nil {
		return nil, err
	}

	// invoices status counts
	if err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'draft'),
			COUNT(*) FILTER (WHERE status = 'confirmed'),
			COUNT(*) FILTER (WHERE status = 'paid'),
			COUNT(*) FILTER (WHERE status = 'cancelled')
		FROM invoices`).Scan(&rep.Invoices.Draft, &rep.Invoices.Confirmed, &rep.Invoices.Paid, &rep.Invoices.Cancelled); err != nil {
		return nil, err
	}

	return &rep, nil
}

func (s *Store) RevenueByMonth(ctx context.Context, from, to string) ([]MonthlyRevenue, error) {
	query := `
		SELECT to_char(date_trunc('month', paid_on), 'YYYY-MM') AS m,
		       COALESCE(SUM(amount_minor), 0) AS rev
		FROM payments
		WHERE ($1 = '' OR paid_on >= $1::date)
		  AND ($2 = '' OR paid_on <= $2::date)
		GROUP BY date_trunc('month', paid_on)
		ORDER BY date_trunc('month', paid_on) ASC`

	rows, err := s.db.QueryContext(ctx, query, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []MonthlyRevenue{}
	for rows.Next() {
		var mr MonthlyRevenue
		if err := rows.Scan(&mr.Month, &mr.RevenueMinor); err != nil {
			return nil, err
		}
		items = append(items, mr)
	}
	return items, rows.Err()
}

func (s *Store) Overdue(ctx context.Context, cursor int64, limit int) ([]OverdueInvoice, error) {
	query := `
		SELECT i.id, i.number, c.name, to_char(i.due_date, 'YYYY-MM-DD'),
		       GREATEST(0, (CURRENT_DATE - i.due_date)::int),
		       (i.total_minor - i.paid_minor)
		FROM invoices i
		JOIN customers c ON i.customer_id = c.id
		WHERE i.status = 'confirmed'
		  AND i.due_date < CURRENT_DATE
		  AND i.paid_minor < i.total_minor
		  AND ($1::bigint = 0 OR i.id < $1)
		ORDER BY i.id DESC
		LIMIT $2`

	rows, err := s.db.QueryContext(ctx, query, cursor, limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []OverdueInvoice
	for rows.Next() {
		var oi OverdueInvoice
		if err := rows.Scan(&oi.InvoiceID, &oi.Number, &oi.CustomerName, &oi.DueDate, &oi.DaysLate, &oi.OutstandingMinor); err != nil {
			return nil, err
		}
		items = append(items, oi)
	}
	return items, rows.Err()
}
