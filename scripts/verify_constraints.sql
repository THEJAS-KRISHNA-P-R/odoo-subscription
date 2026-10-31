-- Run against a database loaded with perf_seed.sql (some tests need existing rows).
-- Each statement MUST fail. Output "BLOCKED" means the database defended the rule.
\set ON_ERROR_STOP off
\echo '1 duplicate email (case-insensitive)'
INSERT INTO users(email,password_hash,full_name,role) VALUES ('PERF-ADMIN@x.test','x','Dup','staff');
\echo '2 bill the same subscription period twice'
INSERT INTO invoices(number,subscription_id,customer_id,period_start,period_end,issue_date,due_date,subtotal_minor,discount_minor,tax_minor,total_minor)
  SELECT 'INV-DUP-1',subscription_id,customer_id,period_start,period_end,issue_date,due_date,subtotal_minor,discount_minor,tax_minor,total_minor FROM invoices ORDER BY id LIMIT 1;
\echo '3 overpay an invoice'
UPDATE invoices SET paid_minor = total_minor + 1 WHERE id = 1;
\echo '4 paid status without full payment'
UPDATE invoices SET status='paid', paid_minor=0 WHERE id = 3;
\echo '5 totals that do not add up'
UPDATE invoices SET total_minor = total_minor + 1 WHERE id = 1;
\echo '6 percent discount above 100%'
INSERT INTO discounts(name,kind,value,start_date,end_date,scope) VALUES ('bad','percent',10001,'2026-01-01','2026-12-31','product');
\echo '7 discount used beyond its limit'
INSERT INTO discounts(name,kind,value,start_date,end_date,usage_limit,used_count,scope) VALUES ('bad','fixed',100,'2026-01-01','2026-12-31',1,2,'product');
\echo '8 discount ends before it starts'
INSERT INTO discounts(name,kind,value,start_date,end_date,scope) VALUES ('bad','fixed',100,'2026-12-31','2026-01-01','product');
\echo '9 subscription expires before it starts'
UPDATE subscriptions SET expiry_date = start_date - 1 WHERE id = 1;
\echo '10 non-active subscription with a billing date'
UPDATE subscriptions SET status='draft', next_billing_date = '2026-11-01' WHERE id = 1;
\echo '11 plan min quantity zero'
INSERT INTO plans(name,price_minor,billing_period,min_quantity,available_from) VALUES ('bad',1,'monthly',0,'2026-01-01');
\echo '12 negative price'
INSERT INTO products(name,type,sales_price_minor,cost_price_minor) VALUES ('bad','software',-1,0);
\echo '13 zero-amount payment'
INSERT INTO payments(invoice_id,method,amount_minor,paid_on,recorded_by) VALUES (1,'cash',0,'2026-10-31',1);
