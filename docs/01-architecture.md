# 01 — Architecture (ADRs)

## System view

```
Browser ── Next.js (SSR shell + client data hooks) ──HTTPS/JSON──▶ Go API (stateless, N copies)
                                                                      │  handler → service → store(SQL)
                                                                      ▼
                                                              PostgreSQL 16  ◀── Billing worker(s)  (SKIP LOCKED)
                                                                      ▲        ◀── Mail worker(s)     (outbox)
                                                              Mailpit (dev SMTP)
```

Everything that can be scaled is stateless. State lives only in Postgres.

## Module map (one folder per domain, flat)

```
backend/internal/
  auth/ users/ customers/ catalog/ plans/ templates/ subscriptions/
  billing/ (calc.go, period.go = pure; engine.go = DB)   discounts/ taxes/
  invoices/ payments/ reports/ mail/ meta/ httpx/ db/
```
Dependency rule: `handler → service → store`. A module may call another module's exported service function, never its store. No interface with one implementation, no ORM, no DI container.

## ADR-002: Stack

**Status:** Accepted. **Decision:** Go stdlib `net/http` + `pgx` + PostgreSQL 16 + Next.js (App Router, TypeScript) + Tailwind.
**Options:** (A) this stack, (B) Node/Express + Postgres, (C) Next.js full-stack + ORM.
| | A Go + Postgres + Next | B Node + Postgres | C Next + ORM |
|---|---|---|---|
| Team familiarity | high | medium | medium |
| Billing concurrency (tx, locks) | explicit, strong | OK | hidden by ORM |
| DB-design visibility to judges | high (plain SQL) | high | low |
| Extra dependencies | few | more | many |
**Consequence:** a little more boilerplate for JSON and validation; everything is explicit and explainable.

## ADR-003: Money is integer minor units

`BIGINT` paise, rates in basis points, rounding half-up per line in one function (`billing.Compute`). Floats forbidden. The DB `CHECK (total = subtotal − discount + tax)` makes arithmetic bugs impossible to persist.

## ADR-004: Billing engine = per-subscription transactions with row locks

`SELECT … FOR UPDATE SKIP LOCKED` on due subscriptions, invoice insert guarded by `UNIQUE (subscription_id, period_start)` + `ON CONFLICT DO NOTHING`. Consequences: run it twice, from two servers, or from a button and a timer at once, and you still get exactly one invoice per period. Throughput scales by adding workers. Alternative rejected: a global lock (simple but serial) and a message queue (extra infrastructure, same guarantee).

## ADR-005: Keyset pagination, never OFFSET

Lists use `id < :cursor ORDER BY id DESC LIMIT n+1`. Cost stays flat at any depth. Filters are covered by `(status, id DESC)` and `(customer_id, id DESC)` indexes.

## ADR-006: Transactional outbox for email

Business change + `email_outbox` row commit together; a worker sends with retry (`attempts`, `next_attempt_at`, exponential backoff, max 5). A mail server outage never breaks billing or sign-up.

## ADR-007: Idempotency keys on money-moving POSTs

`Idempotency-Key` header on `POST /invoices/{id}/payments` and `POST /billing/run`. Same key + same user returns the stored response. Double-click and retry safe.

## ADR-008: No mock data, metadata from the server

`GET /api/v1/meta` returns enum values, labels and the caller's capabilities. The frontend has no hardcoded domain lists and no fixtures. `scripts/check-no-mock.sh` enforces it. Consequence: adding a status or payment method is a backend-only change.

## ADR-009: Auth = httpOnly cookie JWT + server-side role check

bcrypt cost 12, 8h JWT in an httpOnly, Secure, SameSite=Lax cookie. The role in the token is re-read from the DB for admin-only routes so deactivation is immediate.

## Request lifecycle

`request-id → recover → logger → rate-limit → auth → role guard → handler (decode + validate) → service (tx) → store (SQL) → JSON`. Errors leave through one writer (`httpx.Error`) in the shape in doc 04.

## Config (env only)

`DATABASE_URL, JWT_SECRET, SMTP_ADDR, APP_URL, PORT, BILLING_CRON (default "0 2 * * *" i.e. daily 02:00), DB_MAX_CONNS`. `.env.example` is committed, `.env` never.
