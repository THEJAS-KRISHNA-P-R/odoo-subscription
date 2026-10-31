export interface EnumOption {
  value: string;
  label: string;
}

export interface MeProfile {
  id: number | string;
  role: 'admin' | 'staff' | 'customer';
  name: string;
  email: string;
  capabilities: string[];
}

export interface MetaResponse {
  enums: {
    billing_period?: EnumOption[];
    subscription_status?: EnumOption[];
    invoice_status?: EnumOption[];
    payment_method?: EnumOption[];
    discount_kind?: EnumOption[];
    discount_scope?: EnumOption[];
    product_type?: EnumOption[];
    [key: string]: EnumOption[] | undefined;
  };
  subscription_transitions: Record<string, string[]>;
  me?: MeProfile | null;
}

export interface ProductVariant {
  id: number | string;
  attribute: string;
  value: string;
  extra_price_minor: number;
}

export interface Product {
  id: number | string;
  name: string;
  type: string;
  sales_price_minor: number;
  cost_price_minor: number;
  tax_id: number | string | null;
  notes: string;
  is_active: boolean;
  variants: ProductVariant[];
}

export interface Tax {
  id: number | string;
  name: string;
  rate_bp: number;
  is_active: boolean;
}

export interface PaymentTerm {
  id: number | string;
  name: string;
  due_days: number;
}

export interface Plan {
  id: number | string;
  name: string;
  price_minor: number;
  billing_period: string;
  min_quantity: number;
  available_from: string | null;
  available_to: string | null;
  auto_close: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  is_active: boolean;
}

export interface TemplateLine {
  product_id: number | string;
  product_name?: string;
  variant_id?: number | string | null;
  variant_label?: string;
  quantity: number;
}

export interface Template {
  id: number | string;
  name: string;
  plan_id: number | string;
  plan_name: string;
  validity_days: number;
  lines: TemplateLine[];
}

export interface Customer {
  id: number | string;
  name: string;
  company: string;
  phone: string;
  billing_address: string;
  email: string;
}

export interface SubscriptionLine {
  id?: number | string;
  product_id: number | string;
  product_name: string;
  variant_id?: number | string | null;
  variant_label?: string;
  description?: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate_bp: number;
  amount_minor: number;
}

export interface SubscriptionTotals {
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
}

export interface Subscription {
  id: number | string;
  number: string;
  customer_id: number | string;
  customer_name: string;
  plan_id: number | string;
  plan_name: string;
  status: string;
  start_date: string;
  expiry_date: string | null;
  quote_valid_until: string | null;
  next_billing_date: string | null;
  payment_term_id: number | string | null;
  payment_term_name: string;
  lines: SubscriptionLine[];
  totals: SubscriptionTotals;
  allowed_actions?: string[];
}

export interface SubscriptionEvent {
  id: number | string;
  from_status: string | null;
  to_status: string;
  actor_name: string;
  note: string;
  created_at: string;
}

export interface Discount {
  id: number | string;
  name: string;
  kind: string;
  value: number;
  min_purchase_minor: number;
  min_quantity: number;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  used_count: number;
  scope: string;
  is_active: boolean;
  product_ids?: Array<number | string>;
  subscription_ids?: Array<number | string>;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price_minor: number;
  discount_minor: number;
  tax_rate_bp: number;
  tax_minor: number;
  amount_minor: number;
}

export interface InvoiceDiscount {
  name: string;
  amount_minor: number;
}

export interface InvoicePayment {
  id: number | string;
  method: string;
  amount_minor: number;
  paid_on: string;
  note: string;
}

export interface Invoice {
  id: number | string;
  number: string;
  subscription_id: number | string;
  subscription_number: string;
  customer_id: number | string;
  customer_name: string;
  status: string;
  is_overdue: boolean;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  paid_minor: number;
  outstanding_minor: number;
  sent_at: string | null;
  lines?: InvoiceLine[];
  discounts?: InvoiceDiscount[];
  payments?: InvoicePayment[];
}

export interface Payment {
  id: number | string;
  invoice_id: number | string;
  invoice_number: string;
  customer_name: string;
  method: string;
  amount_minor: number;
  paid_on: string;
  note: string;
}

export interface BillingRunResult {
  created: number;
  skipped: number;
  closed: number;
  errors: string[];
}

export interface ReportSummary {
  active_subscriptions: number;
  revenue_minor: number;
  outstanding_minor: number;
  overdue_count: number;
  overdue_minor: number;
  invoices: {
    draft: number;
    confirmed: number;
    paid: number;
    cancelled: number;
  };
}

export interface MonthlyRevenue {
  month: string;
  revenue_minor: number;
}

export interface OverdueInvoice {
  invoice_id: number | string;
  number: string;
  customer_name: string;
  due_date: string;
  days_late: number;
  outstanding_minor: number;
}

export interface StaffMember {
  id: number | string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}
