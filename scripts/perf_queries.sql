\timing on
\echo '--- 1 subscriptions list, status filter, keyset page'
SELECT s.id,s.number,s.status,c.name FROM subscriptions s JOIN customers c ON c.id=s.customer_id
 WHERE s.status='active' AND s.id < 4000 ORDER BY s.id DESC LIMIT 25;
\echo '--- 2 invoices list, customer scoped (portal)'
SELECT id,number,status,total_minor,paid_minor FROM invoices WHERE customer_id=77 ORDER BY id DESC LIMIT 25;
\echo '--- 3 billing due scan (due today)'
SELECT id FROM subscriptions WHERE status='active' AND next_billing_date <= DATE '2026-10-31' ORDER BY next_billing_date LIMIT 500;
\echo '--- 4 dashboard: active subs'
SELECT count(*) FROM subscriptions WHERE status='active';
\echo '--- 5 dashboard: revenue in range'
SELECT COALESCE(sum(amount_minor),0) FROM payments WHERE paid_on BETWEEN '2026-07-01' AND '2026-12-31';
\echo '--- 6 dashboard: outstanding + overdue'
SELECT count(*) FILTER (WHERE due_date < DATE '2026-10-31') AS overdue_count,
       COALESCE(sum(total_minor-paid_minor),0) AS outstanding,
       COALESCE(sum(total_minor-paid_minor) FILTER (WHERE due_date < DATE '2026-10-31'),0) AS overdue_amount
FROM invoices WHERE status='confirmed' AND paid_minor < total_minor;
\echo '--- 7 revenue by month'
SELECT date_trunc('month',paid_on) m, sum(amount_minor) FROM payments WHERE paid_on >= '2026-01-01' GROUP BY 1 ORDER BY 1;
\echo '--- 8 search customers by name (trigram)'
SELECT id,name FROM customers WHERE name ILIKE '%er 19%' LIMIT 25;
\echo '--- 9 invoice detail with lines'
SELECT i.*, l.* FROM invoices i JOIN invoice_lines l ON l.invoice_id=i.id WHERE i.id=12345;
