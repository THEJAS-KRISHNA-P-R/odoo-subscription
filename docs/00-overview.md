# 00 — Overview: what we are building and why

**Brightloop Subscription Management System**: one platform that runs products, plans, subscriptions, invoices, payments and revenue reporting for a company that earns money every month.

**One sentence:** a billing engine that never bills twice and never skips, behind a calm Wise-style UI with three role views, where every pixel of data comes from the backend.

## 1. Users and their jobs

| Who | When | They want to | So that |
|---|---|---|---|
| Customer | I need to know what I pay | see my subscriptions and invoices, pause / close / renew when my plan allows | I never email anyone |
| Staff | It is billing day | generate every due invoice in one click, confirm / send / print, record payments | nothing is typed by hand |
| Admin | I launch a plan | configure products, variants, plans, taxes, discounts, staff | the rules run on their own |
| Finance lead | month end | see active subscriptions, revenue, outstanding, overdue in one place | I can answer in seconds |

## 2. What judges score → what we do

| They said | We do | Proof in repo |
|---|---|---|
| Local Postgres/MySQL design, no Firebase/Supabase/Mongo | PostgreSQL 16, normalized, 23 tables, constraints that refuse bad data | `backend/migrations/001_init.sql`, `scripts/verify_constraints.sql` |
| Real, dynamic data, no static JSON | **Zero mock data.** UI renders only API responses; a script fails the build if mock data appears | `scripts/check-no-mock.sh` |
| Robust validation | DB constraints + server validation + inline field errors in UI | `docs/04-api-spec.md` §5 |
| Git as a team sport | both commit on `main`, small commits, swap blocks | `docs/11-work-plan.md` |
| Clean, interactive UI | Wise design tokens, bento cards, drawers, skeleton/empty/error on every screen | `docs/07-ui-design-system.md` |
| Everyone presents, understand your tools | each tool justified, video script splits speaking | `docs/12-demo-and-submission.md` |
| Scalability, performance, security | keyset pagination, partial indexes, SKIP LOCKED workers, outbox, idempotency, RBAC | `docs/08-scalability.md`, `docs/09-security.md` |

## 3. Requirements coverage map (tick every row at 15:30)

| Statement | Feature | Doc |
|---|---|---|
| Email unique; password > 8 with upper, lower, special; reset link by email | Sign-up, login, forgot/reset | 04, 09 |
| Admin / staff / customer; only admin adds staff | RBAC middleware + Team page | 03 §7, 04 |
| Product: name, type, sales, cost, notes; variants (+560 for Odoo brand) | Products + variants | 02, 03 |
| Plan: price, daily/weekly/monthly/yearly, min qty, dates; auto-close / early close / pause / renew per plan | Plans with four behaviour flags | 02, 03 |
| Quotation template with plan + lines + validity days | Templates + instantiate | 03 |
| Subscription number, customer, plan, dates, payment terms, lines; Draft → Quotation → Confirmed → Active → Closed; visible to team | Subscriptions + event timeline | 03 |
| Billing day: invoices auto-created, taxes automatic, never twice or skipped | Billing engine | 03 §3 |
| Confirm / cancel / send / print invoice; Draft → Confirmed → Paid | Invoice actions | 03 §4 |
| Admin-only discounts: fixed or percent, min purchase/qty, dates, usage limit, product or subscription scope, auto on next invoice | Discounts + auto-apply | 03 §2 |
| Payments with method, amount, date, note; paid vs outstanding; overdue chasing | Payments + overdue view | 03 §5 |
| Finance dashboard with filters + summary, every page < 2s | Insights page + reports API | 04, 08 |
| Customers see only their own subscriptions and invoices | Portal | 04, 06 |

## 4. Decisions on ambiguous points (say these out loud in the video)

| # | Question | Decision |
|---|---|---|
| D1 | "more than eight" characters | at least **9** + upper + lower + special; same rule client and server; live checklist |
| D2 | Plan price vs product price | Line price = `product.sales_price + variant.extra_price`. Plan `price` is the recurring plan fee, added as one auto line "Plan fee". `shortcut: one fee line per plan; split if plans need tiers` |
| D3 | Overdue | derived, not a status: `confirmed AND due_date < today AND paid < total` |
| D4 | Partial payments | allowed; invoice is Paid when `paid = total`; overpay rejected |
| D5 | Pause | subscription status `paused` (only if plan.pausable); billing skips it; resume continues from the next future period, no back-billing |
| D6 | Discount order | discounts apply in id order to what is left of each line, never below zero; tax is on the discounted amount |
| D7 | Discount usage | counted when the invoice is generated; released if the draft is cancelled |
| D8 | Missed billing days | engine catches up period by period (cap 12 per run per subscription) |
| D9 | Sign-up | public sign-up always creates role `customer` |
| D10 | Who pays | team records payments (matches the statement); no payment gateway |
| D11 | **No mock data** | UI shows only backend data. Empty DB shows empty states. Domain lists (statuses, periods, methods, roles) come from `GET /meta`. Demo data is created by `backend/cmd/seed` through the real service layer, never in the frontend |
| D12 | Customer record | created on sign-up (linked to the user); staff may also create customers without a login |

## 5. Non-goals

Payment gateway, multi-currency (INR only), proration, dunning sequences, tax filing, mobile app, i18n.

## 6. Glossary

- **Minor units**: paise. ₹560.00 = `56000`. Never a float.
- **Basis points (bp)**: 1% = 100 bp. 18% GST = `1800`.
- **Plan fee line**: the auto line carrying the plan's own price (D2).
- **Keyset pagination**: `WHERE id < :cursor ORDER BY id DESC LIMIT n`; stable and fast at any depth.
- **Outbox**: emails are inserted in the same transaction as the business change and sent by a worker.
