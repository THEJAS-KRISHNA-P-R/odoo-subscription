# 04 — API specification (`/api/v1`)

## 1. Conventions

- JSON in, JSON out. Auth = httpOnly cookie `session`. State-changing requests must be `Content-Type: application/json`.
- Money: integer minor units (`"total_minor": 390344`). Dates: `YYYY-MM-DD`. Timestamps: RFC 3339 UTC.
- **Lists** (keyset): `GET /x?limit=25&cursor=<id>&...filters` → `{"items":[...],"next_cursor":"1234"|null}`. `limit` max 100. Server-side filters and sorting only.
- **Idempotency**: `Idempotency-Key: <uuid>` on `POST /billing/run` and `POST /invoices/{id}/payments`.
- **Errors** always:
```json
{"error":"validation_failed","message":"Fix the highlighted fields","fields":{"email":"Enter a valid email","password":"Add a special character"}}
```
| Status | `error` | When |
|---|---|---|
| 400 | `bad_request` | unparseable body |
| 401 | `unauthenticated` | no / expired session |
| 403 | `forbidden` | role not allowed |
| 404 | `not_found` | missing, or not yours (customers never learn it exists) |
| 409 | `conflict` / `invalid_transition` | unique violation, bad state change |
| 422 | `validation_failed` | field errors in `fields` |
| 429 | `rate_limited` | too many attempts |
| 500 | `internal` | logged with request id, never leaks details |

Postgres errors map in one place: `23505` → 409 (field-level when the constraint name is known, e.g. `users_email_key` → `fields.email = "This email is already registered"`), `23514` → 422, `23503` → 409.

## 2. Metadata (no hardcoded lists in the UI)

`GET /meta` →
```json
{"enums":{"billing_period":[{"value":"monthly","label":"Monthly"}, ...],
          "subscription_status":[...],"invoice_status":[...],"payment_method":[...],
          "discount_kind":[...],"discount_scope":[...],"product_type":[...]},
 "subscription_transitions":{"draft":["quotation"],"quotation":["confirmed"], ...},
 "me":{"id":1,"role":"staff","name":"…","capabilities":["billing.run","payment.record", ...]}}
```
The UI builds every select, filter pill and button from this. Cache: `max-age=300`.

## 3. Endpoints

| Area | Method + path | Roles | Notes |
|---|---|---|---|
| Auth | `POST /auth/signup` | public | creates `customer` + customer record; 422 per field |
| | `POST /auth/login` | public | rate limited (5/min/IP+email) |
| | `POST /auth/logout`, `GET /auth/me` | any | |
| | `POST /auth/forgot` | public | always 202; queues email if account exists |
| | `POST /auth/reset` `{token,password}` | public | single use, 30 min |
| Team | `GET /staff`, `POST /staff`, `PATCH /staff/{id}` | admin | only way to create staff |
| Catalog | `GET/POST /products`, `GET/PATCH/DELETE /products/{id}` | read: staff+, write: admin | soft delete via `is_active` when referenced |
| | `GET/POST /products/{id}/variants`, `PATCH/DELETE …/{vid}` | admin | |
| | `GET/POST/PATCH /taxes`, `/payment-terms` | read staff+, write admin | |
| Plans | `GET/POST /plans`, `GET/PATCH /plans/{id}` | read staff+, write admin | |
| Templates | `GET/POST /templates`, `GET/PATCH /templates/{id}`, `POST /templates/{id}/instantiate {customer_id}` | read staff+, write admin | instantiate returns a draft subscription |
| Customers | `GET /customers?q=`, `POST`, `GET/PATCH /customers/{id}` | staff+ | `q` uses trigram search |
| Subscriptions | `GET /subscriptions?status=&customer_id=&q=&limit=&cursor=` | staff+ | |
| | `POST /subscriptions`, `GET/PATCH /subscriptions/{id}` | staff+ | PATCH only in draft/quotation |
| | `POST /subscriptions/{id}/transition {to,note}` | staff+ | validated against §03 |
| | `POST /subscriptions/{id}/renew` | staff+ | |
| | `GET /subscriptions/{id}/events` | staff+ | timeline |
| Discounts | `GET/POST /discounts`, `GET/PATCH /discounts/{id}` | read staff+, write admin | includes `product_ids` / `subscription_ids` |
| Billing | `POST /billing/run {as_of?, dry_run?}` | staff+ | returns `{created, skipped, closed, errors[]}` |
| Invoices | `GET /invoices?status=&overdue=true&customer_id=&q=&from=&to=` | staff+ | |
| | `GET /invoices/{id}` | staff+ | lines, discounts, payments |
| | `POST /invoices/{id}/confirm`, `/cancel`, `/send` | staff+ | |
| Payments | `POST /invoices/{id}/payments`, `GET /payments?method=&from=&to=` | staff+ | |
| Reports | `GET /reports/summary?from=&to=` | staff+ | §4 |
| | `GET /reports/revenue-by-month?from=&to=` | staff+ | |
| | `GET /reports/overdue?limit=&cursor=` | staff+ | days late, amount |
| Portal | `GET /me/subscriptions`, `POST /me/subscriptions/{id}/transition` | customer | plan flags enforced |
| | `GET /me/invoices`, `GET /me/invoices/{id}` | customer | own only |
| Health | `GET /healthz` | public | DB ping |

## 4. Sample payloads

**Sign-up** `POST /auth/signup` `{"full_name":"Asha N","email":"asha@shop.in","password":"Strong#Pass1"}` → 201 `{"id":12,"role":"customer"}`
Weak password → 422 `{"error":"validation_failed","fields":{"password":"Password must be more than 8 characters"}}`. Duplicate → 422 `{"fields":{"email":"This email is already registered"}}`.

**Create subscription** `POST /subscriptions`
```json
{"customer_id":4,"plan_id":2,"payment_term_id":2,"start_date":"2026-11-01","expiry_date":"2027-10-31",
 "lines":[{"product_id":7,"variant_id":3,"quantity":2}]}
```
→ 201 with `number`, `status:"draft"`, computed `lines[]` (unit price = product + variant, plan fee line added), `totals`.

**Run billing** `POST /billing/run` `{"dry_run":false}` → `{"created":312,"skipped":0,"closed":4,"errors":[]}`; again → `{"created":0,"skipped":312,...}` (skipped = periods already invoiced).

**Record payment** `POST /invoices/88/payments` `{"method":"upi","amount_minor":150000,"paid_on":"2026-10-31","note":"UTR 1234"}` → 201; overpay → 422 `{"fields":{"amount_minor":"Amount exceeds the outstanding balance of ₹1,062.00"}}`.

**Summary** `GET /reports/summary?from=2026-10-01&to=2026-10-31`
```json
{"active_subscriptions":3500,"revenue_minor":84210000,"outstanding_minor":12100000,
 "overdue_count":87,"overdue_minor":3050000,"invoices":{"draft":210,"confirmed":940,"paid":3820,"cancelled":6}}
```

## 5. Validation rules (server is the source of truth, UI mirrors them)

| Field | Rule | Message |
|---|---|---|
| email | RFC-shaped, ≤ 254, unique (case-insensitive) | "Enter a valid email" / "This email is already registered" |
| password | > 8 chars, upper, lower, special | per failing rule (see `auth.ValidatePassword`) |
| names | trimmed, 1–120 chars | "Name is required" |
| prices | integer ≥ 0 | "Enter a valid amount" |
| quantity | integer ≥ plan.min_quantity | "Minimum quantity for this plan is N" |
| dates | `expiry ≥ start`; discount `end ≥ start`; plan `available_to ≥ available_from` | "End date must be after start date" |
| percent discount | 1–10000 bp (1–100%) | "Percent must be between 1 and 100" |
| usage limit | null or ≥ 1 | "Limit must be at least 1" |
| payment amount | 1 ≤ amount ≤ outstanding | "Amount exceeds the outstanding balance of ₹…" |
| payment date | not in the future | "Payment date cannot be in the future" |
| text | max length, strip control chars | "Too long" |
Request bodies capped at 1 MB; unknown JSON fields rejected.
