# 03 — Business rules

Pure math lives in `backend/internal/billing/calc.go` and `period.go`, with tests that pass (`go test ./...`). Copy them, do not rewrite them.

## 1. Subscription lifecycle

```
draft ──▶ quotation ──▶ confirmed ──▶ active ◀──▶ paused
                                         │
                                         ▼
                                       closed ──(renew, if plan.renewable)──▶ active
```
| Transition | Who | Guard |
|---|---|---|
| draft → quotation | staff, admin | has ≥ 1 line; each qty ≥ plan.min_quantity; plan available today |
| quotation → confirmed | staff, admin | `quote_valid_until >= today` |
| confirmed → active | staff, admin | sets `next_billing_date = start_date` |
| active → paused / paused → active | staff, admin, owning customer | `plan.pausable`; resume sets next billing to the next future period |
| active → closed | staff, admin, owning customer | `plan.closable`; or system at expiry when `plan.auto_close` |
| closed → active (renew) | staff, admin, owning customer | `plan.renewable`; extends `expiry_date` by one plan term |

Every transition writes a row in `subscription_events` (actor NULL = system). Any other transition returns 409 `invalid_transition`.
Quotation templates copy their lines into the subscription (price snapshot) and set `quote_valid_until = today + validity_days`.

## 2. Pricing, discounts, tax

**Line price** = `product.sales_price + variant.extra_price` (Odoo brand: ₹1,000 + ₹560 = ₹1,560). Plan fee is its own line (D2).

**Order of operations (per invoice)**
1. `gross = qty × unit_price`
2. eligible discounts in id order, each on what is left of its lines, never below zero. Percent is `round_half_up(room × bp / 10000)`. Pro-rata split across lines, remainder on the last line so the sum is exact.
3. `net = gross − discount`
4. `tax = round_half_up(net × rate_bp / 10000)` per line
5. totals are sums; `total = subtotal − discount + tax`

**Eligibility of a discount at billing time** (all must hold): `is_active`; `start_date <= issue_date <= end_date`; `used_count < usage_limit` (or no limit); product scope: line product in `discount_products`, line gross ≥ `min_purchase`, line qty ≥ `min_quantity`; subscription scope: subscription in `discount_subscriptions`, invoice subtotal ≥ `min_purchase`, total qty ≥ `min_quantity`. Admin only creates them. Nobody applies them by hand: the engine does.
Usage: `used_count` increments in the invoice-creation transaction (the DB CHECK refuses over-use); cancelling a draft decrements it.

**Worked example (this exact case is a passing test)**

| Line | Qty | Unit | Gross | Discount | Net | Tax 18% |
|---|---|---|---|---|---|---|
| Plan fee | 1 | 500.00 | 500.00 | 0 | 500.00 | 90.00 |
| CRM + Odoo brand | 2 | 1,560.00 | 3,120.00 | 10% = 312.00 | 2,808.00 | 505.44 |
| **Totals** | | | **3,620.00** | **312.00** | | **595.44** |

Total = 3,620.00 − 312.00 + 595.44 = **₹3,903.44** (`390344` minor units).

## 3. Billing engine

```
RunBilling(asOf):                       # triggered by daily worker AND the "Run billing" button
  loop: ids = SELECT id FROM subscriptions
              WHERE status='active' AND next_billing_date <= asOf
              ORDER BY next_billing_date LIMIT 200 FOR UPDATE SKIP LOCKED   # idx_sub_due
        if none: break
        for each id (own transaction, short):
           repeat up to 12 times while next_billing_date <= asOf:
              period = [next_billing_date, Next(next_billing_date, plan.period, anchorDay))
              lines  = subscription_lines + plan fee
              disc   = eligible discounts (see §2)
              t      = billing.Compute(lines, disc)
              INSERT invoice (status draft, due = issue + payment_term.due_days)
                 ON CONFLICT (subscription_id, period_start) DO NOTHING
              if inserted: insert lines, invoice_discounts, used_count++, number from inv_seq
              next_billing_date = period end
           if plan.auto_close AND next_billing_date > expiry_date: status = closed (+event)
  return {created, skipped, closed, errors}
```
Guarantees: run twice → second run creates 0; two workers → disjoint sets, no duplicates; a crash mid-run → only the current subscription rolls back; catch-up never skips a period; paused and non-active subscriptions are never selected. The anchor day is `start_date.Day()`, so Jan 31 → Feb 28 → Mar 31 (tested).
`dryRun=true` returns what would be created and writes nothing.

## 4. Invoice lifecycle

```
draft ──confirm──▶ confirmed ──(payments reach total)──▶ paid
  │                    │
  └──────cancel────────┴──▶ cancelled   (only while paid = 0; releases discount usage)
```
- **Send**: queues an outbox email with the invoice summary and a link; stamps `sent_at` when the worker succeeds. Only confirmed invoices can be sent.
- **Print**: the invoice page has a print stylesheet (A4, no sidebar).
- **Overdue** is derived (D3), shown as a red badge and filter.

## 5. Payments

`POST /invoices/{id}/payments {method, amount_minor, paid_on, note}`: one transaction: lock the invoice row, require `status=confirmed`, require `amount ≤ total − paid`, insert the payment, add to `paid_minor`, set `paid` when equal. `paid_on` may not be in the future. Recorded by staff/admin with `recorded_by` and an audit row.

## 6. Reports (finance lead)

All from stored totals, all filterable by date range (and status where relevant): active subscriptions; revenue = Σ payments in range; outstanding = Σ (total − paid) over confirmed invoices; overdue count and amount; revenue by month; overdue list sorted by days late.

## 7. Roles

| Capability | Admin | Staff | Customer |
|---|---|---|---|
| Add staff / deactivate users | ✅ | ❌ | ❌ |
| Products, variants, plans, taxes, terms, templates | write | read | ❌ |
| Discount rules | write | read | ❌ |
| Customers | ✅ | ✅ | own profile |
| Subscriptions create / confirm / transition | ✅ | ✅ | own: pause / close / renew when the plan allows |
| Run billing, invoice actions, record payments | ✅ | ✅ | ❌ |
| View invoices | all | all | own only |
| Finance dashboard | ✅ | ✅ | ❌ |

Customer queries always append `customer_id = <caller's customer>` inside the store function. A customer id in a URL is never trusted.
