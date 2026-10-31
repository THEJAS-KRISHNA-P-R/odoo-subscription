package payments

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Payment struct {
	ID            int64  `json:"id"`
	InvoiceID     int64  `json:"invoice_id"`
	InvoiceNumber string `json:"invoice_number"`
	CustomerName  string `json:"customer_name"`
	Method        string `json:"method"`
	AmountMinor   int64  `json:"amount_minor"`
	PaidOn        string `json:"paid_on"`
	Note          string `json:"note"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) List(ctx context.Context, method, from, to string, cursor int64, limit int) ([]Payment, error) {
	var (
		conditions []string
		args       []any
		idx        = 1
	)

	if method != "" {
		conditions = append(conditions, fmt.Sprintf("p.method = $%d::pay_method_t", idx))
		args = append(args, method)
		idx++
	}
	if from != "" {
		conditions = append(conditions, fmt.Sprintf("p.paid_on >= $%d::date", idx))
		args = append(args, from)
		idx++
	}
	if to != "" {
		conditions = append(conditions, fmt.Sprintf("p.paid_on <= $%d::date", idx))
		args = append(args, to)
		idx++
	}
	if cursor > 0 {
		conditions = append(conditions, fmt.Sprintf("p.id < $%d", idx))
		args = append(args, cursor)
		idx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT p.id, p.invoice_id, i.number, c.name, p.method, p.amount_minor,
		       to_char(p.paid_on, 'YYYY-MM-DD'), COALESCE(p.note, '')
		FROM payments p
		JOIN invoices i ON p.invoice_id = i.id
		JOIN customers c ON i.customer_id = c.id
		%s
		ORDER BY p.id DESC
		LIMIT $%d`, where, idx)
	args = append(args, limit+1)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Payment
	for rows.Next() {
		var item Payment
		if err := rows.Scan(
			&item.ID, &item.InvoiceID, &item.InvoiceNumber, &item.CustomerName,
			&item.Method, &item.AmountMinor, &item.PaidOn, &item.Note,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
