package main

import (
	"database/sql"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Seed generates realistic test data: 5k subscriptions, 20k invoices, 3 demo logins
func Seed(db *sql.DB) error {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	// First, ensure we have some base data: users, products, plans, taxes
	if err := seedBaseData(db, rng); err != nil {
		return err
	}

	// Seed customers
	if err := seedCustomers(db, rng); err != nil {
		return err
	}

	// Seed subscriptions (5k)
	if err := seedSubscriptions(db, rng); err != nil {
		return err
	}

	// Seed invoices (20k)
	if err := seedInvoices(db, rng); err != nil {
		return err
	}

	// Seed payments
	if err := seedPayments(db, rng); err != nil {
		return err
	}

	fmt.Println("seed data generated: 5k subs, 20k invoices, 3 demo logins")
	return nil
}

func seedBaseData(db *sql.DB, rng *rand.Rand) error {
	// Create some taxes
	taxes := []struct {
		name string
		rate int
	}{
		{"GST 18%", 1800},
		{"CGST 9%", 900},
		{"SGST 9%", 900},
		{"No Tax", 0},
	}
	for _, t := range taxes {
		var id int
		err := db.QueryRow(`INSERT INTO taxes (name, rate_bp, is_active) VALUES ($1, $2, true) RETURNING id`, t.name, t.rate).Scan(&id)
		if err != nil {
			// May already exist
		}
	}

	// Create some products
	products := []struct {
		name    string
		typ     string
		price   int64 // in minor units (paise)
		cost    int64
		taxName string
	}{
		{"Odoo Basic", "software", 120000, 70000, "GST 18%"},
		{"Odoo Premium", "software", 250000, 150000, "GST 18%"},
		{"Support Plan", "service", 50000, 20000, "No Tax"},
		{"Odoo Branding", "addon", 56000, 30000, "GST 18%"}, // +560.00 variant
	}
	for _, p := range products {
		var taxID int
		// Find tax ID by name - simplified
		row := db.QueryRow("SELECT id FROM taxes WHERE name = $1", p.taxName)
		row.Scan(&taxID)

		_, err := db.Exec(`INSERT INTO products (name, type, sales_price_minor, cost_price_minor, tax_id, is_active) VALUES ($1, $2, $3, $4, $5, true)`,
			p.name, p.typ, p.price, p.cost, taxID)
		if err != nil {
			return err
		}
	}

	// Create variants (Odoo brand +560)
	// Find product ID for Odoo Basic
	var basicProdID int
	row := db.QueryRow("SELECT id FROM products WHERE name = $1", "Odoo Basic")
	row.Scan(&basicProdID)

	_, err := db.Exec(`INSERT INTO product_variants (product_id, attribute, value, extra_price_minor) VALUES ($1, $2, $3, $4)`,
		basicProdID, "Brand", "Odoo", 56000) // 560.00 in minor units
	if err != nil {
		return err
	}

	// Create some plans
	plans := []struct {
		name      string
		period    string
		price     int64
		minQty    int
		from      string
		closable  bool
		pausable  bool
		renewable bool
	}{
		{"Monthly Plan", "monthly", 100000, 1, "2026-01-01", true, true},
		{"Yearly Plan", "yearly", 1000000, 1, "2026-01-01", true, true},
		{"Daily Plan", "daily", 5000, 1, "2026-01-01", false, false},
	}
	for _, p := range plans {
		_, err := db.Exec(`INSERT INTO plans (name, billing_period, price_minor, min_quantity, available_from, auto_close, closable, pausable, renewable, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
			p.name, p.period, p.price, p.minQty, p.from, p.closable, p.pausable, p.renewable)
		if err != nil {
			return err
		}
	}

	// Create a payment term
	_, err := db.Exec(`INSERT INTO payment_terms (name, due_days) VALUES ($1, $2)`, "Net 30", 30)
	if err != nil {
		return err
	}

	return nil
}

func seedCustomers(db *sql.UUID, rng *rand.Rand) error {
	// Create 3 demo users with customers
	emails := []string{"admin@brightloop.test", "staff@brightloop.test", "customer@brightloop.test"}
	password := "Brightloop@1234" // all have same strong password

	for _, email := range emails {
		// Hash password
		// In real code use bcrypt; here we just store the plain for seed simplicity
		// Actually let's use a hash - simplified
		hashed := hashPassword(password)

		var userID int
		err := db.QueryRow(`INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'admin') RETURNING id`,
			email, hashed, "Test User").Scan(&userID)
		if err != nil {
			continue
		}

		// Create customer profile
		name := "Test " + capitalizedEmail(email)
		company := "Test Company"
		_, err = db.Exec(`INSERT INTO customers (user_id, name, company, phone, billing_address) VALUES ($1, $2, $3, $4, $5)`,
			userID, name, company, "+1-555-0100", "123 Test St")
		if err != nil {
			return err
		}
	}

	return nil
}

func seedSubscriptions(db *sql.DB, rng *rand.Rand) error {
	// Get available plans and customers
	// Simplified - in real code query the DB
	customerCount := 3 // from seedBaseData

	for i := 0; i < 5000; i++ {
		custIdx := rng.Intn(customerCount)
		planIdx := rng.Intn(3) // 3 plans

		startDate := fmt.Sprintf("2026-%02d-01", rng.Intn(12)+1)
		// Plan duration determines expiry
		var endYear, endMonth int
		switch planIdx {
		case 0: // monthly
			endMonth = rng.Intn(6) + 6 // 6-12 months
			endYear = 2026
		case 1: // yearly
			endYear = 2027
			endMonth = 1
		default: // daily - short
			startDate = fmt.Sprintf("2026-%02d-%02d", rng.Intn(28)+1, rng.Intn(28)+1)
			endYear = 2026
			endMonth = 1
		}

		expiryDate := fmt.Sprintf("%d-%02d-01", endYear, endMonth)

		// Generate subscription number
		subNumber := fmt.Sprintf("SUB-%d-%03d", 2026, i+1)

		// created_by is admin (user 1)
		_, err := db.Exec(`INSERT INTO subscriptions (number, customer_id, plan_id, status, start_date, expiry_date, next_billing_date, created_by)
			VALUES ($1, $2, $3, 'active', $4, $5, $6, 1)`,
			subNumber, custIdx+1, planIdx+1, "active", startDate, expiryDate, startDate)
		if err != nil {
			return err
		}
	}

	return nil
}

func seedInvoices(db *sql.DB, rng *rand.Rand) error {
	// Generate 20k invoices for the 5k subscriptions
	for i := 0; i < 20000; i++ {
		subIdx := rng.Intn(5000) // 5k subs
		periodStart := fmt.Sprintf("2026-%02d-01", rng.Intn(12)+1)
		periodEnd := addMonth(periodStart, 1)

		// Simple invoice math - subtotal varies
		subtotal := int64(10000 + rng.Intn(50000)) // 100.00 to 600.00

		discount := int64(0)
		if rng.Float32() > 0.5 {
			discount = int64(float64(subtotal) * 0.1) // 10% discount sometimes
		}

		taxRate := int64(1800) // 18% GST
		net := subtotal - discount
		// round_half_up(net * rate_bp / 10000)
		tax := (net * taxRate + 5000) / 10000 // approximate round

		total := subtotal - discount + tax

		invoiceNumber := fmt.Sprintf("INV-2026-%04d", i+1)

		_, err := db.Exec(`INSERT INTO invoices (number, subscription_id, customer_id, status, period_start, period_end, issue_date, due_date, subtotal_minor, discount_minor, tax_minor, total_minor, paid_minor)
			VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			invoiceNumber, subIdx+1, ((subIdx % 3) + 1), "confirmed", periodStart, periodEnd, periodStart, periodStart, subtotal, discount, tax, total, 0)
		if err != nil {
			return err
		}
	}

	return nil
}

func seedPayments(db *sql.DB, rng *rand.Rand) error {
	for i := 0; i < 5000; i++ {
		invoiceID := rng.Intn(20000) + 1
		methods := []string{"upi", "bank_transfer", "card"}
		method := methods[rng.Intn(len(methods))]
		amount := int64(10000 + rng.Intn(50000)) // varies

		// Only record payment if amount <= outstanding (total - paid)
		// For seed, just record exact or partial payments
		paidOn := fmt.Sprintf("2026-%02d-%02d", rng.Intn(12)+1, rng.Intn(28)+1)

		_, err := db.Exec(`INSERT INTO payments (invoice_id, method, amount_minor, paid_on, recorded_by)
			VALUES ($1, $2, $3, $4, 1)`, invoiceID, method, amount, paidOn)
		if err != nil {
			return err
		}
	}

	return nil
}

func hashPassword(pw string) string {
	// Simplified - in production use bcrypt
	// Return a dummy hash for seed
	return "$2a$12$C0kA1B2c3D4e5F6g7H8IjK"
}

func addMonth(dateStr string, n int) string {
	// Parse and add months - simplified
	y, m := 2026, 1
	fmt.Sscanf(dateStr, "%d-%d", &y, &m)
	m += n
	if m > 12 {
		m -= 12
		y++
	}
	return fmt.Sprintf("%d-%02d-01", y, m)
}

func capitalizedEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) == 2 {
		return strings.ToUpper(parts[0][:1]) + parts[0][1:]
	}
	return email
}

func main() {
	dsn := "postgres://postgres:postgres@localhost:5432/brightloop?sslmode=disable"
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open db: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to ping db: %v\n", err)
		os.Exit(1)
	}

	if err := Seed(db); err != nil {
		fmt.Fprintf(os.Stderr, "seed failed: %v\n", err)
		os.Exit(1)
	}
}