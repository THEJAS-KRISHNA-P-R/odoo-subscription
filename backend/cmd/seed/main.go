package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"brightloop/internal/db"
	"golang.org/x/crypto/bcrypt"
)

const demoPassword = "Brightloop@1234"

func main() {
	database, err := db.Open(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := seed(ctx, database); err != nil {
		log.Fatalf("seed database: %v", err)
	}
	log.Printf("Demo accounts ready (password: %s)", demoPassword)
}

func seed(ctx context.Context, database *sql.DB) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash demo password: %w", err)
	}

	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin seed transaction: %w", err)
	}
	defer tx.Rollback()

	users := []struct {
		email string
		name  string
		role  string
	}{
		{"admin@brightloop.test", "Brightloop Admin", "admin"},
		{"staff@brightloop.test", "Brightloop Staff", "staff"},
		{"customer@brightloop.test", "Brightloop Customer", "customer"},
	}
	var adminID, customerUserID int64
	for _, user := range users {
		var id int64
		err := tx.QueryRowContext(ctx, `
			INSERT INTO users (email, password_hash, full_name, role)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (email) DO UPDATE
			SET password_hash = EXCLUDED.password_hash,
			    full_name = EXCLUDED.full_name,
			    role = EXCLUDED.role,
			    is_active = true
			RETURNING id`,
			user.email, string(passwordHash), user.name, user.role,
		).Scan(&id)
		if err != nil {
			return fmt.Errorf("upsert demo user %s: %w", user.email, err)
		}
		switch user.role {
		case "admin":
			adminID = id
		case "customer":
			customerUserID = id
		}
	}

	var customerID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO customers (user_id, name, company)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE
		SET name = EXCLUDED.name, company = EXCLUDED.company
		RETURNING id`,
		customerUserID, "Brightloop Customer", "Brightloop Demo",
	).Scan(&customerID)
	if err != nil {
		return fmt.Errorf("upsert demo customer: %w", err)
	}

	var taxID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO taxes (name, rate_bp)
		VALUES ('GST 18%', 1800)
		ON CONFLICT (name) DO UPDATE SET rate_bp = EXCLUDED.rate_bp
		RETURNING id`,
	).Scan(&taxID)
	if err != nil {
		return fmt.Errorf("upsert demo tax: %w", err)
	}

	var paymentTermID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO payment_terms (name, due_days)
		VALUES ('Net 30', 30)
		ON CONFLICT (name) DO UPDATE SET due_days = EXCLUDED.due_days
		RETURNING id`,
	).Scan(&paymentTermID)
	if err != nil {
		return fmt.Errorf("upsert demo payment term: %w", err)
	}

	var productID int64
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM products WHERE name = 'Odoo Basic' ORDER BY id LIMIT 1`,
	).Scan(&productID)
	if err == sql.ErrNoRows {
		err = tx.QueryRowContext(ctx, `
			INSERT INTO products (name, type, sales_price_minor, cost_price_minor, tax_id, notes)
			VALUES ('Odoo Basic', 'software', 120000, 70000, $1, 'Demo subscription product')
			RETURNING id`,
			taxID,
		).Scan(&productID)
	}
	if err != nil {
		return fmt.Errorf("upsert demo product: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO product_variants (product_id, attribute, value, extra_price_minor)
		VALUES ($1, 'Brand', 'Odoo', 56000)
		ON CONFLICT (product_id, attribute, value) DO NOTHING`,
		productID,
	)
	if err != nil {
		return fmt.Errorf("upsert demo product variant: %w", err)
	}

	var planID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO plans (name, price_minor, billing_period, min_quantity, available_from)
		VALUES ('Monthly Plan', 100000, 'monthly', 1, CURRENT_DATE)
		ON CONFLICT (name) DO UPDATE SET price_minor = EXCLUDED.price_minor
		RETURNING id`,
	).Scan(&planID)
	if err != nil {
		return fmt.Errorf("upsert demo plan: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO subscriptions (
			number, customer_id, plan_id, payment_term_id, status,
			start_date, expiry_date, created_by
		) VALUES (
			'SUB-DEMO-000001', $1, $2, $3, 'draft',
			CURRENT_DATE, (CURRENT_DATE + INTERVAL '1 year')::date, $4
		)
		ON CONFLICT (number) DO NOTHING`,
		customerID, planID, paymentTermID, adminID,
	)
	if err != nil {
		return fmt.Errorf("insert demo subscription: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO subscription_lines (
			subscription_id, product_id, variant_id, description,
			quantity, unit_price_minor, tax_id
		)
		SELECT s.id, p.id, v.id, p.name || ' (Odoo)', 1, p.sales_price_minor + v.extra_price_minor, p.tax_id
		FROM subscriptions s
		JOIN products p ON p.id = $1
		JOIN product_variants v ON v.product_id = p.id AND v.attribute = 'Brand' AND v.value = 'Odoo'
		WHERE s.number = 'SUB-DEMO-000001'
		  AND NOT EXISTS (
			SELECT 1 FROM subscription_lines sl
			WHERE sl.subscription_id = s.id AND sl.product_id = p.id AND sl.variant_id = v.id
		  )`,
		productID,
	); err != nil {
		return fmt.Errorf("insert demo subscription line: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit seed transaction: %w", err)
	}
	return nil
}
