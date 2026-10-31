CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE role_t        AS ENUM ('admin','staff','customer');
CREATE TYPE period_t      AS ENUM ('daily','weekly','monthly','yearly');
CREATE TYPE sub_status_t  AS ENUM ('draft','quotation','confirmed','active','paused','closed');
CREATE TYPE inv_status_t  AS ENUM ('draft','confirmed','paid','cancelled');
CREATE TYPE disc_kind_t   AS ENUM ('fixed','percent');
CREATE TYPE disc_scope_t  AS ENUM ('product','subscription');
CREATE TYPE pay_method_t  AS ENUM ('cash','bank_transfer','card','upi','cheque');

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  role role_t NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE password_resets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL, company TEXT, phone TEXT, billing_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('software','service','addon','physical')),
  sales_price_minor BIGINT NOT NULL CHECK (sales_price_minor >= 0),
  cost_price_minor  BIGINT NOT NULL CHECK (cost_price_minor  >= 0),
  tax_id BIGINT REFERENCES taxes(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute TEXT NOT NULL,
  value TEXT NOT NULL,
  extra_price_minor BIGINT NOT NULL DEFAULT 0,
  UNIQUE (product_id, attribute, value)
);

CREATE SEQUENCE sub_seq; CREATE SEQUENCE inv_seq;
CREATE TABLE plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price_minor BIGINT NOT NULL CHECK (price_minor >= 0),
  billing_period period_t NOT NULL,
  min_quantity INT NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  available_from DATE NOT NULL,
  available_to DATE,
  auto_close BOOLEAN NOT NULL DEFAULT false,
  closable BOOLEAN NOT NULL DEFAULT true,
  pausable BOOLEAN NOT NULL DEFAULT false,
  renewable BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
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

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  plan_id BIGINT NOT NULL REFERENCES plans(id),
  template_id BIGINT REFERENCES quotation_templates(id),
  payment_term_id BIGINT NOT NULL REFERENCES payment_terms(id),
  status sub_status_t NOT NULL DEFAULT 'draft',
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  quote_valid_until DATE,
  next_billing_date DATE,
  paused_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expiry_date >= start_date)
);
CREATE TABLE subscription_lines (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
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
  actor_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE discounts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind disc_kind_t NOT NULL,
  value BIGINT NOT NULL CHECK (value > 0),
  min_purchase_minor BIGINT NOT NULL DEFAULT 0,
  min_quantity INT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  usage_limit INT CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  scope disc_scope_t NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CHECK (end_date >= start_date),
  CHECK (kind <> 'percent' OR value <= 10000),
  CHECK (usage_limit IS NULL OR used_count <= usage_limit)
);
CREATE TABLE discount_products (
  discount_id BIGINT REFERENCES discounts(id) ON DELETE CASCADE,
  product_id  BIGINT REFERENCES products(id)  ON DELETE CASCADE,
  PRIMARY KEY (discount_id, product_id)
);
CREATE TABLE discount_subscriptions (
  discount_id BIGINT REFERENCES discounts(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE CASCADE,
  PRIMARY KEY (discount_id, subscription_id)
);

CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  status inv_status_t NOT NULL DEFAULT 'draft',
  period_start DATE NOT NULL, period_end DATE NOT NULL,
  issue_date DATE NOT NULL, due_date DATE NOT NULL,
  subtotal_minor BIGINT NOT NULL, discount_minor BIGINT NOT NULL DEFAULT 0,
  tax_minor BIGINT NOT NULL, total_minor BIGINT NOT NULL,
  paid_minor BIGINT NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_start),
  CHECK (paid_minor >= 0 AND paid_minor <= total_minor),
  CHECK (total_minor >= 0)
);
CREATE TABLE invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  description TEXT NOT NULL,
  quantity INT NOT NULL, unit_price_minor BIGINT NOT NULL,
  discount_minor BIGINT NOT NULL DEFAULT 0,
  tax_rate_bp INT NOT NULL DEFAULT 0, tax_minor BIGINT NOT NULL DEFAULT 0,
  amount_minor BIGINT NOT NULL
);
CREATE TABLE invoice_discounts (
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
  discount_id BIGINT REFERENCES discounts(id),
  amount_minor BIGINT NOT NULL,
  PRIMARY KEY (invoice_id, discount_id)
);
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  method pay_method_t NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  paid_on DATE NOT NULL, note TEXT,
  recorded_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance (design for the 2s rule)
CREATE INDEX idx_sub_due      ON subscriptions (next_billing_date) WHERE status = 'active';
CREATE INDEX idx_sub_customer ON subscriptions (customer_id);
CREATE INDEX idx_sub_status   ON subscriptions (status);
CREATE INDEX idx_sub_lines    ON subscription_lines (subscription_id);
CREATE INDEX idx_inv_customer ON invoices (customer_id, issue_date DESC);
CREATE INDEX idx_inv_status   ON invoices (status, due_date);
CREATE INDEX idx_inv_open     ON invoices (due_date) WHERE status = 'confirmed' AND paid_minor < total_minor;
CREATE INDEX idx_inv_lines    ON invoice_lines (invoice_id);
CREATE INDEX idx_pay_invoice  ON payments (invoice_id);
CREATE INDEX idx_pay_date     ON payments (paid_on);
CREATE INDEX idx_evt_sub      ON subscription_events (subscription_id, created_at);