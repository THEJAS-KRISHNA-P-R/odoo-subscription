-- LOAD TEST ONLY. Run against a throwaway database (brightloop_perf), never the demo DB.
-- The demo DB is filled by `backend/cmd/seed`, which goes through the real service layer.
BEGIN;
INSERT INTO users(email,password_hash,full_name,role) VALUES ('perf-admin@x.test','x','Perf Admin','admin');
INSERT INTO taxes(name,rate_bp) VALUES ('GST 18%',1800),('GST 5%',500);
INSERT INTO payment_terms(name,due_days) VALUES ('Immediate',0),('Net 15',15),('Net 30',30);
INSERT INTO products(name,type,sales_price_minor,cost_price_minor,tax_id)
  SELECT 'Product '||g, (ARRAY['software','service','addon'])[1+g%3], 100000+g*5000, 40000, 1 FROM generate_series(1,30) g;
INSERT INTO plans(name,price_minor,billing_period,available_from)
  SELECT 'Plan '||g, 50000*g, (ARRAY['monthly','yearly','weekly','daily'])[1+g%4]::period_t, '2026-01-01' FROM generate_series(1,8) g;
INSERT INTO customers(name) SELECT 'Customer '||g FROM generate_series(1,2000) g;
SELECT setval('sub_seq',1,false);
INSERT INTO subscriptions(number,customer_id,plan_id,payment_term_id,status,start_date,expiry_date,next_billing_date,created_by)
  SELECT 'SUB-'||lpad(g::text,6,'0'), 1+g%2000, 1+g%8, 1+g%3,
         (CASE WHEN g%10<7 THEN 'active' WHEN g%10<8 THEN 'closed' WHEN g%10<9 THEN 'draft' ELSE 'confirmed' END)::sub_status_t,
         '2026-01-01','2027-12-31',
         CASE WHEN g%10<7 THEN DATE '2026-10-01' + (g%45) END, 1
  FROM generate_series(1,5000) g;
INSERT INTO subscription_lines(subscription_id,product_id,description,quantity,unit_price_minor,tax_id)
  SELECT s.id, 1+(s.id*k)%30, 'Line', 1+(s.id%5), 150000, 1 FROM subscriptions s, generate_series(1,3) k;
INSERT INTO invoices(number,subscription_id,customer_id,status,period_start,period_end,issue_date,due_date,
                     subtotal_minor,discount_minor,tax_minor,total_minor,paid_minor)
  SELECT 'INV-2026-'||lpad((s.id*10+m)::text,7,'0'), s.id, s.customer_id,
         CASE WHEN m=1 THEN 'paid' WHEN m=2 THEN 'paid' WHEN m=3 THEN 'confirmed' ELSE 'draft' END::inv_status_t,
         DATE '2026-06-01' + (m*30), DATE '2026-06-01' + (m*30) + 30,
         DATE '2026-06-01' + (m*30), DATE '2026-06-01' + (m*30) + 15,
         100000, 10000, 16200, 106200,
         CASE WHEN m<=2 THEN 106200 WHEN m=3 AND s.id%3=0 THEN 50000 ELSE 0 END
  FROM subscriptions s, generate_series(1,4) m;
INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor,discount_minor,tax_rate_bp,tax_minor,amount_minor)
  SELECT id,'Line',1,100000,10000,1800,16200,90000 FROM invoices;
INSERT INTO payments(invoice_id,method,amount_minor,paid_on,recorded_by)
  SELECT id,(ARRAY['cash','upi','card','bank_transfer'])[1+id%4]::pay_method_t, paid_minor, issue_date+5, 1
  FROM invoices WHERE paid_minor>0;
COMMIT;
ANALYZE;
