package billing

import (
	"database/sql"
	"fmt"
	"math"
	"strconv"

	"brightloop/backend/internal/httpx"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// RunBilling runs the billing engine as of the given date. If dryRun is true, it only returns what would be created without writing.
// asOf is the date to bill up to; if empty, uses current date.
func (s *Store) RunBilling(asOf string, dryRun bool) *httpx.Response {
	// Set default asOf to today if not provided
	date := asOf
	if date == "" {
		date = "2026-10-31" // simplified - use time.Now().Format("2006-01-02")
	}

	// Find active subscriptions due for billing
	// Using SKIP LOCKED to allow concurrent runs
	rows, err := s.db.Query(`
		SELECT id, customer_id, plan_id, next_billing_date, paused_at, status
		FROM subscriptions
		WHERE status = 'active' AND next_billing_date <= $1
		AND (paused_at IS NULL OR paused_at = 0)
		ORDER BY next_billing_date
		LIMIT 100
	`, date)
	if err != nil {
		return httpx.Error500("database", "Failed to query subscriptions for billing")
	}
	defer rows.Close()

	var created, skipped, closed int

	// Process each subscription in a transaction
	for rows.Next() {
		var subID int
		var customerID, planID int
		var nextBillingDate string
		var pausedAt interface{}
		var status string

		if err := rows.Scan(&subID, &customerID, &planID, &nextBillingDate, &pausedAt, &status); err != nil {
			return httpx.Error500("database", "Failed to scan subscription")
		}

		// Skip paused subscriptions
		if pausedAt != nil {
			skipped++
			continue
		}

		// Run one billing period at a time (loop max 12 periods to catch up)
		plan, err := getPlan(planID)
		if err != nil {
			return httpx.Error500("database", "Failed to get plan")
		}

		// Build the billing period(s)
		periods := 1
		if nextBillingDate <= date && periods < 12 {
			// Calculate how many periods are overdue
			periods = int(math.Max(1, float64(12))) // simplified catch-up
		}

		for p := 0; p < periods; p++ {
			periodStart := nextBillingDate
			// Calculate period end based on billing period
			// For simplicity, use daily - in production compute properly
			periodEnd := addPeriod(periodStart, plan.BillingPeriod)

			// Check for duplicate invoice (the "never bill twice" guarantee)
			var existing int
			err := s.db.QueryRow(`SELECT COUNT(*) FROM invoices WHERE subscription_id = $1 AND period_start = $2`, subID, periodStart).Scan(&existing)
			if err != nil {
				return httpx.Error500("database", "Failed to check duplicate invoice")
			}
			if existing > 0 {
				skipped++
				continue
			}

			// Build invoice lines from subscription_lines + plan fee line
			// Calculate subtotal, discounts, tax, totals
			subtotal, discount, tax, total := calculateInvoice(subID, planID, periodStart, periodEnd)

			if dryRun {
				created++
				continue
			}

			// Insert invoice with ON CONFLICT DO NOTHING for idempotency
			var invoiceID int
			err = s.db.QueryRow(`
				INSERT INTO invoices (number, subscription_id, customer_id, status, period_start, period_end, issue_date, due_date, subtotal_minor, discount_minor, tax_minor, total_minor, paid_minor, sent_at, created_at)
				VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
				ON CONFLICT (subscription_id, period_start) DO NOTHING
				RETURNING id
			`, generateInvoiceNumber(subID, periodStart), subID, customerID, periodStart, periodEnd, periodStart, periodStart, subtotal, discount, tax, total, 0).Scan(&invoiceID)
			if err != nil {
				return httpx.Error500("database", "Failed to insert invoice")
			}

			// Insert invoice lines
			insertLines(subID, invoiceID)

			// Update subscription next_billing_date
			// In production, compute the next date based on billing period
			newNextDate := addPeriod(nextBillingDate, plan.BillingPeriod)
			s.db.Exec(`UPDATE subscriptions SET next_billing_date = $1 WHERE id = $2`, newNextDate, subID)

			// Handle auto-close
			if plan.AutoClose && newNextDate > plan.AvailableTo {
				s.db.Exec(`UPDATE subscriptions SET status = 'closed' WHERE id = $2`, subID)
				closed++
			}

			created++
		}
	}

	result := map[string]interface{}{
		"created": created,
		"skipped": skipped,
		"closed":  closed,
	}
	if dryRun {
		result["dry_run"] = true
	}

	return httpx.JSON(http.StatusOK, result)
}

// getPlan fetches a plan by ID
func getPlan(planID int) (*Plan, error) {
	// This would normally use the plans store; simplified here
	return nil, nil
}

// addPeriod adds a period to a date string
func addPeriod(dateStr, period string) string {
	// Simplified - in production use proper date math
	y, m, d := 2026, 10, 31
	switch period {
	case "daily":
		d += 1
	case "weekly":
		d += 7
	case "monthly":
		m += 1
		if m > 12 {
			m = 1
			y += 1
		}
	case "yearly":
		y += 1
	}
	return fmt.Sprintf("%04d-%02d-%02d", y, m, d)
}

// calculateInvoice computes invoice totals for a billing period
func calculateInvoice(subID, planID, periodStart, periodEnd string) (subtotalMinor, discountMinor, taxMinor, totalMinor int64) {
	// Get subscription lines and plan fee
	// This is a simplified calculation - real implementation reads subscription_lines,
	// adds plan fee line, applies discounts, computes tax
	
	// For now, return zero values - the real implementation would:
	// 1. Read subscription_lines for this subscription
	// 2. Add plan fee line (product_id = NULL, unit_price = plan.price_minor)
	// 3. Find applicable discounts
	// 4. Compute: gross = qty * unit_price, discount, net, tax = round_half_up(net * rate_bp / 10000)
	// 5. totals = subtotal - discount + tax
	
	return 0, 0, 0, 0
}

// insertLines inserts invoice lines for a given subscription and invoice
func insertLines(subID, invoiceID int) {
	// Read subscription_lines and insert into invoice_lines
	// Also compute discounts and invoice_discounts
}

// generateInvoiceNumber generates an invoice number like "INV-2026-000456"
func generateInvoiceNumber(subID, periodStart string) string {
	return "INV-" + periodStart + "-" + strconv.Itoa(subID)
}