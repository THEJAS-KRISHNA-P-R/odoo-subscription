-- Brightloop Subscription Management System — schema v1
-- Money = BIGINT minor units (paise). Rates = basis points (1% = 100). No floats.
-- Constraints do the validating; the API only maps constraint errors to field errors.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE role_t        AS ENUM ('admin','staff','customer');
CREATE TYPE period_t      AS ENUM ('daily','weekly','monthly','yearly');
CREATE TYPE sub_status_t  AS ENUM ('draft','quotation','confirmed','active','paused','closed');
CREATE TYPE inv_status_t  AS ENUM ('draft','confirmed','paid','cancelled');
CREATE TYPE disc_kind_t   AS ENUM ('fixed','percent');
CREATE TYPE disc_scope_t  AS ENUM ('product','subscription');
CREATE TYPE pay_method_t  AS ENUM ('cash','bank_transfer','card','upi','cheque');
CREATE TYPE mail_status_t AS ENUM ('pending','sent','failed');

-- ───────── identity ─────────
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
  role role_t NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE password_resets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,            -- sha256 of the emailed token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  company TEXT, phone TEXT, billing_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────── catalog ─────────
CREATE TABLE taxes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rate_bp INT NOT NULL CHECK (rate_bp BETWEEN 0 AND 10000),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE payment_terms (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  due_days INT NOT NULL CHECK (due_days >= 0)
);
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  type TEXT NOT NULL CHECK (type IN ('software','service','addon','physical')),
  sales_price_minor BIGINT NOT NULL CHECK (sales_price_minor >= 0),
  cost_price_minor  BIGINT NOT NULL CHECK (cost_price_minor  >= 0),
  tax_id BIGINT REFERENCES taxes(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL,                    -- e.g. Brand
  value TEXT NOT NULL,                        -- e.g. Odoo
  extra_price_minor BIGINT NOT NULL DEFAULT 0 CHECK (extra_price_minor >= 0), -- 56000 = 560.00
  UNIQUE (product_id, attribute, value)
);

-- ───────── plans & templates ─────────
CREATE TABLE plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price_minor BIGINT NOT NULL CHECK (price_minor >= 0),
  billing_period period_t NOT NULL,
  min_quantity INT NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  available_from DATE NOT NULL,
  available_to DATE,
  auto_close BOOLEAN NOT NULL DEFAULT false,
  closable   BOOLEAN NOT NULL DEFAULT true,
  pausable   BOOLEAN NOT NULL DEFAULT false,
  renewable  BOOLEAN NOT NULL DEFAULT true,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  CHECK (available_to IS NULL OR available_to >= available_from)
);
CREATE TABLE quotation_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  plan_id BIGINT NOT NULL REFERENCES plans(id),
  validity_days INT NOT NULL CHECK (validity_days > 0)
);
CREATE TABLE quotation_template_lines (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  variant_id BIGINT REFERENCES product_variants(id),
  quantity INT NOT NULL CHECK (quantity > 0)
);

-- ───────── subscriptions ─────────
CREATE SEQUENCE sub_seq;
CREATE SEQUENCE inv_seq;
CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,                -- SUB-000123
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  plan_id BIGINT NOT NULL REFERENCES plans(id),
  template_id BIGINT REFERENCES quotation_templates(id),
  payment_term_id BIGINT NOT NULL REFERENCES payment_terms(id),
  status sub_status_t NOT NULL DEFAULT 'draft',
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  quote_valid_until DATE,
  next_billing_date DATE,                     -- set only while active
  paused_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expiry_date >= start_date),
  CHECK (status = 'active' OR next_billing_date IS NULL),
  CHECK ((status = 'paused') = (paused_at IS NOT NULL))
);
CREATE TABLE subscription_lines (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),  -- NULL = plan fee line
  variant_id BIGINT REFERENCES product_variants(id),
  description TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  tax_id BIGINT REFERENCES taxes(id)
);
CREATE TABLE subscription_events (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  from_status sub_status_t,
  to_status sub_status_t NOT NULL,
  actor_id BIGINT REFERENCES users(id),       -- NULL = system (billing engine)
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────── discounts ─────────
CREATE TABLE discounts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  kind disc_kind_t NOT NULL,
  value BIGINT NOT NULL CHECK (value > 0),    -- minor units if fixed, basis points if percent
  min_purchase_minor BIGINT NOT NULL DEFAULT 0 CHECK (min_purchase_minor >= 0),
  min_quantity INT NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  usage_limit INT CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  scope disc_scope_t NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CHECK (end_date >= start_date),
  CHECK (kind <> 'percent' OR value <= 10000),
  CHECK (usage_limit IS NULL OR used_count <= usage_limit)   -- DB refuses over-use
);
CREATE TABLE discount_products (
  discount_id BIGINT NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  PRIMARY KEY (discount_id, product_id)
);
CREATE TABLE discount_subscriptions (
  discount_id     BIGINT NOT NULL REFERENCES discounts(id)     ON DELETE CASCADE,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  PRIMARY KEY (discount_id, subscription_id)
);

-- ───────── invoices & payments ─────────
CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,                -- INV-2026-000456
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  status inv_status_t NOT NULL DEFAULT 'draft',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor BIGINT NOT NULL CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
  paid_minor BIGINT NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_start),     -- "never bill twice", enforced by the database
  CHECK (period_end > period_start),
  CHECK (due_date >= issue_date),
  CHECK (paid_minor <= total_minor),
  CHECK (total_minor = subtotal_minor - discount_minor + tax_minor),
  CHECK (status <> 'paid' OR paid_minor = total_minor),
  CHECK (status <> 'cancelled' OR paid_minor = 0)
);
CREATE TABLE invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  description TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_rate_bp INT NOT NULL DEFAULT 0 CHECK (tax_rate_bp BETWEEN 0 AND 10000),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0)   -- after discount, before tax
);
CREATE TABLE invoice_discounts (
  invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  discount_id BIGINT NOT NULL REFERENCES discounts(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  PRIMARY KEY (invoice_id, discount_id)
);
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  method pay_method_t NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  paid_on DATE NOT NULL,
  note TEXT,
  recorded_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────── platform tables (scale + safety) ─────────
CREATE TABLE email_outbox (                    -- mail is queued in the same tx, sent by a worker
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,                          -- reset | invoice | reminder
  to_email CITEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  ref_id BIGINT,
  status mail_status_t NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE idempotency_keys (                -- double-click / retry safety for POSTs
  key TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL,
  status_code INT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT REFERENCES users(id),
  action TEXT NOT NULL,                        -- e.g. invoice.confirm, discount.create
  entity TEXT NOT NULL,
  entity_id BIGINT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────── indexes (keyset pagination + the 2s rule) ─────────
-- Lists page with: WHERE id < :cursor ORDER BY id DESC LIMIT n   (no OFFSET, ever)
CREATE INDEX idx_sub_status_id    ON subscriptions (status, id DESC);
CREATE INDEX idx_sub_customer_id  ON subscriptions (customer_id, id DESC);
CREATE INDEX idx_sub_due          ON subscriptions (next_billing_date) WHERE status = 'active';
CREATE INDEX idx_sub_lines        ON subscription_lines (subscription_id);
CREATE INDEX idx_inv_status_id    ON invoices (status, id DESC);
CREATE INDEX idx_inv_customer_id  ON invoices (customer_id, id DESC);
CREATE INDEX idx_inv_sub          ON invoices (subscription_id);
CREATE INDEX idx_inv_open_due     ON invoices (due_date) WHERE status = 'confirmed' AND paid_minor < total_minor;
CREATE INDEX idx_inv_lines        ON invoice_lines (invoice_id);
CREATE INDEX idx_pay_invoice      ON payments (invoice_id);
CREATE INDEX idx_pay_date_amt     ON payments (paid_on) INCLUDE (amount_minor);   -- index-only revenue sums
CREATE INDEX idx_evt_sub          ON subscription_events (subscription_id, id);
CREATE INDEX idx_outbox_pending   ON email_outbox (next_attempt_at) WHERE status = 'pending';
CREATE INDEX idx_audit_entity     ON audit_log (entity, entity_id, id DESC);
CREATE INDEX idx_cust_name_trgm   ON customers USING gin (name gin_trgm_ops);     -- fast ILIKE search
CREATE INDEX idx_sub_number_trgm  ON subscriptions USING gin (number gin_trgm_ops);
CREATE INDEX idx_inv_number_trgm  ON invoices USING gin (number gin_trgm_ops);
