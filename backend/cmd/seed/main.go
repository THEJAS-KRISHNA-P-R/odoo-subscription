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

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := seed(ctx, database); err != nil {
		log.Fatalf("seed database: %v", err)
	}
	log.Printf("✓ Database seeded successfully!")
	log.Printf("=====================================================")
	log.Printf("Demo Credentials (Password for all: %s):", demoPassword)
	log.Printf("  • Admin:    admin@brightloop.test")
	log.Printf("  • Staff:    staff@brightloop.test")
	log.Printf("  • Customer: customer@brightloop.test")
	log.Printf("=====================================================")
}

func seed(ctx context.Context, database *sql.DB) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash demo password: %w", err)
	}
	hashStr := string(passwordHash)

	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin seed transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Users
	users := []struct {
		email, name, role string
	}{
		{"admin@brightloop.test", "Aarav Sharma (Admin)", "admin"},
		{"staff@brightloop.test", "Priya Patel (Billing Specialist)", "staff"},
		{"rohan@brightloop.test", "Rohan Gupta (Support Lead)", "staff"},
		{"ananya@brightloop.test", "Ananya Iyer (Finance Analyst)", "staff"},
		{"customer@brightloop.test", "Vikram Malhotra (Nexus Tech)", "customer"},
		{"zenith.user@brightloop.test", "Rajesh Nair (Zenith Logistics)", "customer"},
	}

	userMap := make(map[string]int64)
	for _, u := range users {
		var id int64
		err := tx.QueryRowContext(ctx, `
			INSERT INTO users (email, password_hash, full_name, role, is_active)
			VALUES ($1, $2, $3, $4::role_t, true)
			ON CONFLICT (email) DO UPDATE
			SET password_hash = EXCLUDED.password_hash,
			    full_name = EXCLUDED.full_name,
			    role = EXCLUDED.role,
			    is_active = true
			RETURNING id`,
			u.email, hashStr, u.name, u.role,
		).Scan(&id)
		if err != nil {
			return fmt.Errorf("upsert user %s: %w", u.email, err)
		}
		userMap[u.email] = id
	}

	adminID := userMap["admin@brightloop.test"]
	staffID := userMap["staff@brightloop.test"]
	custUserID1 := userMap["customer@brightloop.test"]
	custUserID2 := userMap["zenith.user@brightloop.test"]

	// 2. Customers
	type custData struct {
		userID  *int64
		name    string
		company string
		phone   string
		address string
	}
	custs := []custData{
		{&custUserID1, "Vikram Malhotra", "Nexus Technologies Pvt Ltd", "+91 98765 43210", "Prestige Tech Park, Outer Ring Rd, Bangalore 560103"},
		{&custUserID2, "Rajesh Nair", "Zenith Logistics India", "+91 98111 22334", "Sector 18, Udyog Vihar, Gurgaon 122015"},
		{nil, "Meera Sundaram", "Kaveri Retail Systems", "+91 94444 55667", "12 Anna Nagar Second Ave, Chennai 600040"},
		{nil, "Sunil Joshi", "Horizon Healthcare Corp", "+91 97222 33445", "Bandra Kurla Complex, Mumbai 400051"},
	}

	custIDs := make([]int64, len(custs))
	for i, c := range custs {
		var cid int64
		if c.userID != nil {
			err = tx.QueryRowContext(ctx, `
				INSERT INTO customers (user_id, name, company, phone, billing_address)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (user_id) DO UPDATE
				SET name = EXCLUDED.name, company = EXCLUDED.company, phone = EXCLUDED.phone, billing_address = EXCLUDED.billing_address
				RETURNING id`,
				*c.userID, c.name, c.company, c.phone, c.address,
			).Scan(&cid)
		} else {
			err = tx.QueryRowContext(ctx, `
				INSERT INTO customers (name, company, phone, billing_address)
				VALUES ($1, $2, $3, $4)
				RETURNING id`,
				c.name, c.company, c.phone, c.address,
			).Scan(&cid)
		}
		if err != nil {
			return fmt.Errorf("upsert customer %s: %w", c.name, err)
		}
		custIDs[i] = cid
	}

	// 3. Taxes
	taxData := []struct {
		name string
		bp   int
	}{
		{"GST 18%", 1800},
		{"GST 12%", 1200},
		{"GST 5%", 500},
		{"Zero Tax 0%", 0},
	}
	taxMap := make(map[string]int64)
	for _, t := range taxData {
		var tid int64
		err = tx.QueryRowContext(ctx, `
			INSERT INTO taxes (name, rate_bp, is_active)
			VALUES ($1, $2, true)
			ON CONFLICT (name) DO UPDATE SET rate_bp = EXCLUDED.rate_bp, is_active = true
			RETURNING id`, t.name, t.bp).Scan(&tid)
		if err != nil {
			return fmt.Errorf("upsert tax %s: %w", t.name, err)
		}
		taxMap[t.name] = tid
	}
	gst18ID := taxMap["GST 18%"]

	// 4. Payment Terms
	termData := []struct {
		name string
		days int
	}{
		{"Immediate (Due on receipt)", 0},
		{"Net 15", 15},
		{"Net 30", 30},
		{"Net 60", 60},
	}
	termMap := make(map[string]int64)
	for _, pt := range termData {
		var pid int64
		err = tx.QueryRowContext(ctx, `
			INSERT INTO payment_terms (name, due_days)
			VALUES ($1, $2)
			ON CONFLICT (name) DO UPDATE SET due_days = EXCLUDED.due_days
			RETURNING id`, pt.name, pt.days).Scan(&pid)
		if err != nil {
			return fmt.Errorf("upsert payment term %s: %w", pt.name, err)
		}
		termMap[pt.name] = pid
	}
	net30ID := termMap["Net 30"]

	// 5. Products & Variants
	type prodInfo struct {
		name        string
		pType       string
		sales, cost int64
		taxID       int64
		notes       string
	}
	prods := []prodInfo{
		{"Odoo ERP Core Suite", "software", 200000, 100000, gst18ID, "Comprehensive business ERP backend"},
		{"CRM & Pipeline Automation", "service", 150000, 60000, gst18ID, "Omnichannel lead & sales pipeline management"},
		{"Subscription Billing Engine", "software", 120000, 50000, gst18ID, "Automated recurring ledger & invoice generation"},
		{"Cloud Infra Maintenance", "service", 350000, 150000, gst18ID, "DevOps 99.9% uptime SLA monitoring"},
		{"Dedicated Support Retainer (24/7)", "service", 500000, 200000, gst18ID, "Priority ticket escalation response"},
		{"API Gateway Connector", "addon", 40000, 15000, gst18ID, "REST & Webhook endpoints connector"},
	}

	prodMap := make(map[string]int64)
	for _, p := range prods {
		var pid int64
		err = tx.QueryRowContext(ctx, `
			SELECT id FROM products WHERE name = $1 LIMIT 1`, p.name).Scan(&pid)
		if err == sql.ErrNoRows {
			err = tx.QueryRowContext(ctx, `
				INSERT INTO products (name, type, sales_price_minor, cost_price_minor, tax_id, notes, is_active)
				VALUES ($1, $2, $3, $4, $5, $6, true)
				RETURNING id`,
				p.name, p.pType, p.sales, p.cost, p.taxID, p.notes,
			).Scan(&pid)
		}
		if err != nil {
			return fmt.Errorf("upsert product %s: %w", p.name, err)
		}
		prodMap[p.name] = pid
	}

	// Product Variants
	odooID := prodMap["Odoo ERP Core Suite"]
	var varEnterpriseID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO product_variants (product_id, attribute, value, extra_price_minor)
		VALUES ($1, 'Edition', 'Enterprise Platinum', 80000)
		ON CONFLICT (product_id, attribute, value) DO UPDATE SET extra_price_minor = EXCLUDED.extra_price_minor
		RETURNING id`, odooID).Scan(&varEnterpriseID)
	if err != nil {
		return fmt.Errorf("upsert variant: %w", err)
	}

	// 6. Plans
	plans := []struct {
		name       string
		priceMinor int64
		period     string
		minQty     int
	}{
		{"Monthly Professional Plan", 99900, "monthly", 1},
		{"Annual Enterprise Suite", 999900, "yearly", 1},
		{"Weekly Growth Plan", 29900, "weekly", 1},
	}
	planMap := make(map[string]int64)
	for _, pl := range plans {
		var plID int64
		err = tx.QueryRowContext(ctx, `
			INSERT INTO plans (name, price_minor, billing_period, min_quantity, available_from, closable, pausable, renewable, is_active)
			VALUES ($1, $2, $3::period_t, $4, CURRENT_DATE - INTERVAL '6 months', true, true, true, true)
			ON CONFLICT (name) DO UPDATE SET price_minor = EXCLUDED.price_minor
			RETURNING id`, pl.name, pl.priceMinor, pl.period, pl.minQty).Scan(&plID)
		if err != nil {
			return fmt.Errorf("upsert plan %s: %w", pl.name, err)
		}
		planMap[pl.name] = plID
	}
	monthlyPlanID := planMap["Monthly Professional Plan"]
	annualPlanID := planMap["Annual Enterprise Suite"]

	// 7. Quotation Templates
	var tplID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO quotation_templates (name, plan_id, validity_days)
		VALUES ('Standard SaaS Growth Suite', $1, 30)
		ON CONFLICT (name) DO UPDATE SET validity_days = EXCLUDED.validity_days
		RETURNING id`, monthlyPlanID).Scan(&tplID)
	if err == nil {
		_, _ = tx.ExecContext(ctx, `DELETE FROM quotation_template_lines WHERE template_id = $1`, tplID)
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO quotation_template_lines (template_id, product_id, quantity)
			VALUES ($1, $2, 1), ($1, $3, 2)`,
			tplID, prodMap["Odoo ERP Core Suite"], prodMap["CRM & Pipeline Automation"])
	}

	// 8. Discounts
	_, _ = tx.ExecContext(ctx, `
		INSERT INTO discounts (name, kind, value, min_purchase_minor, min_quantity, start_date, end_date, usage_limit, used_count, scope, is_active)
		VALUES
		  ('Welcome 15% Launch Offer', 'percent'::disc_kind_t, 1500, 100000, 1, '2026-01-01', '2027-12-31', 100, 5, 'subscription'::disc_scope_t, true),
		  ('Flat ₹500 Annual Loyalty', 'fixed'::disc_kind_t, 50000, 200000, 1, '2026-01-01', '2027-12-31', 50, 12, 'subscription'::disc_scope_t, true)
		ON CONFLICT DO NOTHING`)

	// 9. Subscriptions
	now := time.Now().UTC()
	today := now.Format("2006-01-02")
	oneMonthAgo := now.AddDate(0, -1, 0).Format("2006-01-02")
	nextMonth := now.AddDate(0, 1, 0).Format("2006-01-02")
	oneYearLater := now.AddDate(1, 0, 0).Format("2006-01-02")

	type subSeed struct {
		number     string
		custID     int64
		planID     int64
		status     string
		start      string
		expiry     string
		nextBill   *string
	}

	subSeeds := []subSeed{
		{"SUB-2026-000001", custIDs[0], monthlyPlanID, "active", oneMonthAgo, oneYearLater, &nextMonth},
		{"SUB-2026-000002", custIDs[1], annualPlanID, "active", oneMonthAgo, oneYearLater, &oneYearLater},
		{"SUB-2026-000003", custIDs[2], monthlyPlanID, "confirmed", today, oneYearLater, nil},
		{"SUB-2026-000004", custIDs[3], annualPlanID, "quotation", today, oneYearLater, nil},
		{"SUB-2026-000005", custIDs[0], monthlyPlanID, "paused", oneMonthAgo, oneYearLater, nil},
	}

	subIDMap := make(map[string]int64)
	for _, ss := range subSeeds {
		var sid int64
		var pausedAt *time.Time
		if ss.status == "paused" {
			t := time.Now().UTC()
			pausedAt = &t
		}
		err = tx.QueryRowContext(ctx, `
			INSERT INTO subscriptions (
				number, customer_id, plan_id, payment_term_id, status,
				start_date, expiry_date, next_billing_date, paused_at, created_by
			) VALUES ($1, $2, $3, $4, $5::sub_status_t, $6::date, $7::date, $8::date, $9, $10)
			ON CONFLICT (number) DO UPDATE
			SET status = EXCLUDED.status, next_billing_date = EXCLUDED.next_billing_date, paused_at = EXCLUDED.paused_at
			RETURNING id`,
			ss.number, ss.custID, ss.planID, net30ID, ss.status,
			ss.start, ss.expiry, ss.nextBill, pausedAt, adminID,
		).Scan(&sid)
		if err != nil {
			return fmt.Errorf("upsert subscription %s: %w", ss.number, err)
		}
		subIDMap[ss.number] = sid

		// Insert plan fee line
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO subscription_lines (subscription_id, product_id, description, quantity, unit_price_minor, tax_id)
			VALUES ($1, NULL, 'Monthly Subscription Plan Fee', 1, 99900, $2)
			ON CONFLICT DO NOTHING`, sid, gst18ID)

		// Insert product line
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO subscription_lines (subscription_id, product_id, description, quantity, unit_price_minor, tax_id)
			VALUES ($1, $2, 'Odoo ERP Core Suite', 1, 200000, $3)
			ON CONFLICT DO NOTHING`, sid, odooID, gst18ID)

		// Event
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO subscription_events (subscription_id, from_status, to_status, actor_id, note)
			VALUES ($1, NULL, $2::sub_status_t, $3, 'Initial setup')`, sid, ss.status, staffID)
	}

	// 10. Invoices & Payments for analytics / dashboard
	invSeeds := []struct {
		number      string
		subNum      string
		custID      int64
		status      string
		issueDate   string
		dueDate     string
		subtotal    int64
		tax         int64
		total       int64
		paid        int64
		paymentMeth *string
	}{
		{
			number:      "INV-2026-000101",
			subNum:      "SUB-2026-000001",
			custID:      custIDs[0],
			status:      "paid",
			issueDate:   oneMonthAgo,
			dueDate:     today,
			subtotal:    299900,
			tax:         53982,
			total:       353882,
			paid:        353882,
			paymentMeth: ptrStr("upi"),
		},
		{
			number:      "INV-2026-000102",
			subNum:      "SUB-2026-000002",
			custID:      custIDs[1],
			status:      "paid",
			issueDate:   now.AddDate(0, -2, 0).Format("2006-01-02"),
			dueDate:     oneMonthAgo,
			subtotal:    999900,
			tax:         179982,
			total:       1179882,
			paid:        1179882,
			paymentMeth: ptrStr("bank_transfer"),
		},
		{
			number:      "INV-2026-000103",
			subNum:      "SUB-2026-000001",
			custID:      custIDs[0],
			status:      "confirmed",
			issueDate:   now.AddDate(0, -1, -15).Format("2006-01-02"),
			dueDate:     now.AddDate(0, 0, -5).Format("2006-01-02"), // overdue!
			subtotal:    299900,
			tax:         53982,
			total:       353882,
			paid:        100000, // partially paid
			paymentMeth: ptrStr("card"),
		},
		{
			number:      "INV-2026-000104",
			subNum:      "SUB-2026-000003",
			custID:      custIDs[2],
			status:      "draft",
			issueDate:   today,
			dueDate:     nextMonth,
			subtotal:    299900,
			tax:         53982,
			total:       353882,
			paid:        0,
			paymentMeth: nil,
		},
	}

	for _, inv := range invSeeds {
		var invID int64
		sid := subIDMap[inv.subNum]
		pStart := inv.issueDate
		pEnd := nextMonth
		err = tx.QueryRowContext(ctx, `
			INSERT INTO invoices (
				number, subscription_id, customer_id, status, period_start, period_end,
				issue_date, due_date, subtotal_minor, discount_minor, tax_minor, total_minor, paid_minor
			) VALUES ($1, $2, $3, $4::inv_status_t, $5::date, $6::date, $7::date, $8::date, $9, 0, $10, $11, $12)
			ON CONFLICT (number) DO UPDATE
			SET status = EXCLUDED.status, paid_minor = EXCLUDED.paid_minor
			RETURNING id`,
			inv.number, sid, inv.custID, inv.status, pStart, pEnd,
			inv.issueDate, inv.dueDate, inv.subtotal, inv.tax, inv.total, inv.paid,
		).Scan(&invID)
		if err != nil {
			return fmt.Errorf("upsert invoice %s: %w", inv.number, err)
		}

		// Line items
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price_minor, discount_minor, tax_rate_bp, tax_minor, amount_minor)
			VALUES ($1, 'Core Subscription & ERP Package', 1, $2, 0, 1800, $3, $2)
			ON CONFLICT DO NOTHING`, invID, inv.subtotal, inv.tax)

		// Payments
		if inv.paid > 0 && inv.paymentMeth != nil {
			_, _ = tx.ExecContext(ctx, `
				INSERT INTO payments (invoice_id, method, amount_minor, paid_on, note, recorded_by)
				VALUES ($1, $2::pay_method_t, $3, $4::date, 'Automated Seed Payment Confirmation', $5)
				ON CONFLICT DO NOTHING`, invID, *inv.paymentMeth, inv.paid, inv.issueDate, adminID)
		}
	}

	return tx.Commit()
}

func ptrStr(s string) *string {
	return &s
}
