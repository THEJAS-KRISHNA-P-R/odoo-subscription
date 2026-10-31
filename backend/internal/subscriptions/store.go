package subscriptions

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"brightloop/internal/billing"
)

// Subscription is the full view returned by GET /subscriptions/{id}.
type Subscription struct {
	ID              int64   `json:"id"`
	Number          string  `json:"number"`
	CustomerID      int64   `json:"customer_id"`
	CustomerName    string  `json:"customer_name"`
	PlanID          int64   `json:"plan_id"`
	PlanName        string  `json:"plan_name"`
	Status          string  `json:"status"`
	StartDate       string  `json:"start_date"`
	ExpiryDate      string  `json:"expiry_date"`
	QuoteValidUntil *string `json:"quote_valid_until"`
	NextBillingDate *string `json:"next_billing_date"`
	PaymentTermID   int64   `json:"payment_term_id"`
	PaymentTermName string  `json:"payment_term_name"`
	Lines           []Line  `json:"lines"`
	Totals          Totals  `json:"totals"`
	AllowedActions  []string `json:"allowed_actions"`
}

// Line is one subscription line item.
type Line struct {
	ID             int64  `json:"id"`
	ProductID      *int64 `json:"product_id"`
	ProductName    string `json:"product_name"`
	VariantID      *int64 `json:"variant_id"`
	VariantLabel   string `json:"variant_label"`
	Description    string `json:"description"`
	Quantity       int    `json:"quantity"`
	UnitPriceMinor int64  `json:"unit_price_minor"`
	TaxRateBP      int    `json:"tax_rate_bp"`
	AmountMinor    int64  `json:"amount_minor"` // qty * unit, before tax
}

// Totals is computed from Lines; never stored directly on subscriptions.
type Totals struct {
	SubtotalMinor int64 `json:"subtotal_minor"`
	TaxMinor      int64 `json:"tax_minor"`
	TotalMinor    int64 `json:"total_minor"`
}

// Event is one row in subscription_events.
type Event struct {
	ID         int64     `json:"id"`
	FromStatus *string   `json:"from_status"`
	ToStatus   string    `json:"to_status"`
	ActorName  string    `json:"actor_name"`
	Note       string    `json:"note"`
	CreatedAt  time.Time `json:"created_at"`
}

// LineInput is what callers provide when creating a subscription.
type LineInput struct {
	ProductID      *int64
	VariantID      *int64
	Description    string
	Quantity       int
	UnitPriceMinor int64
	TaxID          *int64
}

// BillingRunResult summarises one billing-run execution.
type BillingRunResult struct {
	Created int      `json:"created"`
	Skipped int      `json:"skipped"`
	Closed  int      `json:"closed"`
	Errors  []string `json:"errors"`
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

const selectSub = `
    SELECT s.id, s.number, s.customer_id, c.name, s.plan_id, p.name,
           s.status, s.start_date::text, s.expiry_date::text,
           s.quote_valid_until::text, s.next_billing_date::text,
           s.payment_term_id, COALESCE(pt.name,''),
           p.closable, p.pausable, p.renewable
    FROM subscriptions s
    JOIN customers c ON c.id = s.customer_id
    JOIN plans p ON p.id = s.plan_id
    LEFT JOIN payment_terms pt ON pt.id = s.payment_term_id`

func scanSub(row interface{ Scan(...any) error }) (*Subscription, error) {
	var s Subscription
	var closable, pausable, renewable bool
	if err := row.Scan(
		&s.ID, &s.Number, &s.CustomerID, &s.CustomerName,
		&s.PlanID, &s.PlanName, &s.Status,
		&s.StartDate, &s.ExpiryDate, &s.QuoteValidUntil, &s.NextBillingDate,
		&s.PaymentTermID, &s.PaymentTermName,
		&closable, &pausable, &renewable,
	); err != nil {
		return nil, err
	}
	s.Lines = []Line{}
	s.Totals = Totals{}
	s.AllowedActions = allowedActions(s.Status, closable, pausable, renewable)
	return &s, nil
}

func (s *Store) List(ctx context.Context, status, customerID string, cursor int64, limit int) ([]Subscription, error) {
	rows, err := s.db.QueryContext(ctx, selectSub+`
        WHERE ($1 = '' OR s.status::text = $1)
          AND ($2 = '' OR s.customer_id = $2::bigint)
          AND ($3::bigint = 0 OR s.id < $3)
        ORDER BY s.id DESC LIMIT $4`,
		status, customerID, cursor, limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]Subscription, 0)
	for rows.Next() {
		sub, err := scanSub(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *sub)
	}
	return list, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (*Subscription, error) {
	sub, err := scanSub(s.db.QueryRowContext(ctx, selectSub+` WHERE s.id = $1`, id))
	if err != nil {
		return nil, err
	}
	lines, err := s.getLines(ctx, id)
	if err != nil {
		return nil, err
	}
	sub.Lines = lines
	sub.Totals = computeTotals(lines)
	return sub, nil
}

func (s *Store) getLines(ctx context.Context, subID int64) ([]Line, error) {
	rows, err := s.db.QueryContext(ctx, `
        SELECT sl.id, sl.product_id, COALESCE(pr.name,''), sl.variant_id,
               COALESCE(pv.value,''), sl.description, sl.quantity, sl.unit_price_minor,
               COALESCE(t.rate_bp,0)
        FROM subscription_lines sl
        LEFT JOIN products pr ON pr.id = sl.product_id
        LEFT JOIN product_variants pv ON pv.id = sl.variant_id
        LEFT JOIN taxes t ON t.id = sl.tax_id
        WHERE sl.subscription_id = $1 ORDER BY sl.id`, subID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lines := make([]Line, 0)
	for rows.Next() {
		var l Line
		if err := rows.Scan(&l.ID, &l.ProductID, &l.ProductName, &l.VariantID,
			&l.VariantLabel, &l.Description, &l.Quantity, &l.UnitPriceMinor, &l.TaxRateBP); err != nil {
			return nil, err
		}
		l.AmountMinor = int64(l.Quantity) * l.UnitPriceMinor
		lines = append(lines, l)
	}
	return lines, rows.Err()
}

func computeTotals(lines []Line) Totals {
	var t Totals
	for _, l := range lines {
		t.SubtotalMinor += l.AmountMinor
		t.TaxMinor += (l.AmountMinor*int64(l.TaxRateBP) + 5000) / 10000
	}
	t.TotalMinor = t.SubtotalMinor + t.TaxMinor
	return t
}

// Create inserts a new subscription in 'draft' status within a single transaction.
func (s *Store) Create(ctx context.Context,
	customerID, planID, paymentTermID, createdBy int64,
	templateID *int64,
	startDate, expiryDate string, quoteValidUntil *string,
	lines []LineInput) (int64, error) {

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var num string
	if err := tx.QueryRowContext(ctx,
		`SELECT 'SUB-' || LPAD(nextval('sub_seq')::text, 6, '0')`).Scan(&num); err != nil {
		return 0, err
	}
	var id int64
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO subscriptions
         (number, customer_id, plan_id, template_id, payment_term_id, created_by,
          start_date, expiry_date, quote_valid_until, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8::date,$9::date,'draft') RETURNING id`,
		num, customerID, planID, templateID, paymentTermID, createdBy,
		startDate, expiryDate, quoteValidUntil).Scan(&id); err != nil {
		return 0, err
	}
	for _, l := range lines {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO subscription_lines
             (subscription_id, product_id, variant_id, description, quantity, unit_price_minor, tax_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			id, l.ProductID, l.VariantID, l.Description, l.Quantity, l.UnitPriceMinor, l.TaxID); err != nil {
			return 0, err
		}
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO subscription_events (subscription_id, from_status, to_status, actor_id, note)
         VALUES ($1, NULL, 'draft', $2, 'Created')`, id, createdBy); err != nil {
		return 0, err
	}
	return id, tx.Commit()
}

// Transition moves a subscription to a new status; enforces allowed transitions.
func (s *Store) Transition(ctx context.Context, subID int64, newStatus string, actorID int64, note string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var current, startDate, planPeriod string
	var closable, pausable, renewable bool
	if err := tx.QueryRowContext(ctx,
		`SELECT s.status, s.start_date::text, p.billing_period, p.closable, p.pausable, p.renewable
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.id = $1 FOR UPDATE`, subID).
		Scan(&current, &startDate, &planPeriod, &closable, &pausable, &renewable); err != nil {
		return err
	}

	allowed := allowedActions(current, closable, pausable, renewable)
	ok := false
	for _, a := range allowed {
		if a == newStatus {
			ok = true
			break
		}
	}
	if !ok {
		return fmt.Errorf("invalid_transition")
	}

	extra := ""
	if newStatus == "active" && current == "confirmed" {
		extra = fmt.Sprintf(`, next_billing_date = '%s'::date`, startDate)
	} else if newStatus == "paused" {
		extra = `, paused_at = now()`
	} else if newStatus == "active" && current == "paused" {
		extra = `, paused_at = NULL`
	} else if newStatus == "active" && current == "closed" {
		now := time.Now().UTC()
		next := billing.Next(now, planPeriod, now.Day()).Format("2006-01-02")
		extra = fmt.Sprintf(`, next_billing_date = '%s'::date, expiry_date = (expiry_date + interval '1 year')::date`, next)
	} else if newStatus == "closed" {
		extra = `, next_billing_date = NULL`
	}

	if _, err := tx.ExecContext(ctx,
		fmt.Sprintf(`UPDATE subscriptions SET status = $2%s WHERE id = $1`, extra),
		subID, newStatus); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO subscription_events (subscription_id, from_status, to_status, actor_id, note)
         VALUES ($1, $2, $3, $4, $5)`, subID, current, newStatus, actorID, note); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) ListEvents(ctx context.Context, subID int64) ([]Event, error) {
	rows, err := s.db.QueryContext(ctx, `
        SELECT e.id, e.from_status, e.to_status,
               COALESCE(u.full_name,'System'), COALESCE(e.note,''), e.created_at
        FROM subscription_events e
        LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.subscription_id = $1 ORDER BY e.id`, subID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]Event, 0)
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.FromStatus, &e.ToStatus, &e.ActorName, &e.Note, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// RunBilling generates invoices for all active subscriptions due on or before today.
// shortcut: no discount application in billing-run; upgrade when discount-on-invoice is needed.
func (s *Store) RunBilling(ctx context.Context, actorID int64, today time.Time) (*BillingRunResult, error) {
	todayStr := today.Format("2006-01-02")
	rows, err := s.db.QueryContext(ctx, `
        SELECT s.id, s.customer_id, s.payment_term_id, s.start_date::text,
               s.next_billing_date::text, s.expiry_date::text,
               p.billing_period, p.auto_close
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'active'
          AND s.next_billing_date IS NOT NULL
          AND s.next_billing_date <= $1::date`, todayStr)
	if err != nil {
		return nil, err
	}
	type dueRow struct {
		id, custID, termID                       int64
		startStr, nextStr, expiryStr, periodStr  string
		autoClose                                bool
	}
	var dues []dueRow
	for rows.Next() {
		var d dueRow
		if err := rows.Scan(&d.id, &d.custID, &d.termID,
			&d.startStr, &d.nextStr, &d.expiryStr, &d.periodStr, &d.autoClose); err != nil {
			rows.Close()
			return nil, err
		}
		dues = append(dues, d)
	}
	rows.Close()

	res := &BillingRunResult{Errors: []string{}}
	for _, d := range dues {
		if err := s.billOne(ctx, d.id, d.custID, d.termID, actorID,
			d.startStr, d.nextStr, d.expiryStr, d.periodStr, d.autoClose, todayStr); err != nil {
			if err.Error() == "already_billed" {
				res.Skipped++
			} else {
				res.Errors = append(res.Errors, fmt.Sprintf("sub %d: %v", d.id, err))
			}
		} else {
			res.Created++
		}
	}
	return res, nil
}

func (s *Store) billOne(ctx context.Context,
	subID, custID, termID, actorID int64,
	startStr, nextStr, expiryStr, periodStr string,
	autoClose bool, todayStr string) error {

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// idempotency: skip if already billed for this period
	var existing int
	_ = tx.QueryRowContext(ctx,
		`SELECT 1 FROM invoices WHERE subscription_id = $1 AND period_start = $2::date`,
		subID, nextStr).Scan(&existing)
	if existing == 1 {
		return fmt.Errorf("already_billed")
	}

	// load subscription lines
	rows, err := tx.QueryContext(ctx, `
        SELECT sl.product_id, sl.description, sl.quantity, sl.unit_price_minor, COALESCE(t.rate_bp,0)
        FROM subscription_lines sl
        LEFT JOIN taxes t ON t.id = sl.tax_id
        WHERE sl.subscription_id = $1 ORDER BY sl.id`, subID)
	if err != nil {
		return err
	}
	type lineRow struct {
		pid  *int64
		desc string
		qty  int
		unit int64
		taxBP int64
	}
	var slines []lineRow
	for rows.Next() {
		var l lineRow
		if err := rows.Scan(&l.pid, &l.desc, &l.qty, &l.unit, &l.taxBP); err != nil {
			rows.Close()
			return err
		}
		slines = append(slines, l)
	}
	rows.Close()

	blines := make([]billing.Line, len(slines))
	for i, l := range slines {
		blines[i] = billing.Line{ProductID: 0, Qty: int64(l.qty), UnitMinor: l.unit, TaxBP: l.taxBP}
		if l.pid != nil {
			blines[i].ProductID = *l.pid
		}
	}
	totals := billing.Compute(blines, nil)

	var dueDays int
	_ = tx.QueryRowContext(ctx, `SELECT due_days FROM payment_terms WHERE id = $1`, termID).Scan(&dueDays)

	nextDate, _ := time.Parse("2006-01-02", nextStr)
	startDate, _ := time.Parse("2006-01-02", startStr)
	expiryDate, _ := time.Parse("2006-01-02", expiryStr)
	today, _ := time.Parse("2006-01-02", todayStr)

	periodEnd := billing.Next(nextDate, periodStr, startDate.Day()).AddDate(0, 0, -1)
	issueDate := today.Format("2006-01-02")
	dueDate := today.AddDate(0, 0, dueDays).Format("2006-01-02")

	var invNum string
	_ = tx.QueryRowContext(ctx,
		`SELECT 'INV-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('inv_seq')::text, 6, '0')`).Scan(&invNum)

	var invID int64
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO invoices
         (number, subscription_id, customer_id, status, period_start, period_end,
          issue_date, due_date, subtotal_minor, discount_minor, tax_minor, total_minor)
         VALUES ($1,$2,$3,'draft',$4::date,$5::date,$6::date,$7::date,$8,0,$9,$10)
         RETURNING id`,
		invNum, subID, custID, nextStr, periodEnd.Format("2006-01-02"),
		issueDate, dueDate, totals.Subtotal, totals.Tax, totals.Total,
	).Scan(&invID); err != nil {
		return err
	}

	for i, l := range slines {
		res := totals.Lines[i]
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO invoice_lines
             (invoice_id, product_id, description, quantity, unit_price_minor,
              discount_minor, tax_rate_bp, tax_minor, amount_minor)
             VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8)`,
			invID, l.pid, l.desc, l.qty, l.unit, l.taxBP, res.Tax, res.Net); err != nil {
			return err
		}
	}

	// advance next_billing_date; auto-close if past expiry
	nextBilling := billing.Next(nextDate, periodStr, startDate.Day())
	if autoClose && !expiryDate.IsZero() && !nextBilling.Before(expiryDate) {
		if _, err := tx.ExecContext(ctx,
			`UPDATE subscriptions SET next_billing_date = NULL, status = 'closed' WHERE id = $1`, subID); err != nil {
			return err
		}
	} else {
		if _, err := tx.ExecContext(ctx,
			`UPDATE subscriptions SET next_billing_date = $2::date WHERE id = $1`,
			subID, nextBilling.Format("2006-01-02")); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func allowedActions(status string, closable, pausable, renewable bool) []string {
	switch status {
	case "draft":
		return []string{"quotation"}
	case "quotation":
		return []string{"confirmed"}
	case "confirmed":
		return []string{"active", "closed"}
	case "active":
		a := []string{}
		if pausable {
			a = append(a, "paused")
		}
		if closable {
			a = append(a, "closed")
		}
		return a
	case "paused":
		a := []string{"active"}
		if closable {
			a = append(a, "closed")
		}
		return a
	case "closed":
		if renewable {
			return []string{"active"}
		}
		return []string{}
	default:
		return []string{}
	}
}
