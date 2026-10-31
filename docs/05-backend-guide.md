# 05 — Backend guide (Go)

Reference code that already compiles and passes tests: `backend/internal/billing/{calc,period}.go`, `backend/internal/auth/password.go`. Everything else follows the patterns below.

## Layering (strict)

```
handler.go   decode JSON → validate → call service → write JSON      (no SQL, no business rules)
service.go   business rules, owns the transaction, calls stores       (no HTTP types)
store.go     SQL only, takes a pgx tx/pool, returns plain structs     (no business rules)
```
Folder per domain under `internal/`. Shared: `httpx` (JSON, errors, middleware), `db` (pool, `WithTx`, migrations).

## Patterns to copy

**Transaction helper (`db.WithTx`)**: begin → run fn → commit; rollback on error or panic. Services never call Begin/Commit by hand.

**Pg error mapping (`httpx.FromPg`)**: one switch on SQLSTATE and constraint name → `{status, field, message}`. Add constraint names to a map (`users_email_key → email`) instead of string-matching messages.

**Keyset list query**
```sql
SELECT … FROM invoices
WHERE ($1::inv_status_t IS NULL OR status = $1)
  AND ($2::bigint IS NULL OR id < $2)
ORDER BY id DESC LIMIT $3 + 1;       -- extra row tells you next_cursor
```

**Locking a row for a state change**: `SELECT … FROM invoices WHERE id=$1 FOR UPDATE` as the first statement of the service transaction.

**Outbox write**: inside the same tx: `INSERT INTO email_outbox(kind,to_email,subject,body,ref_id)`.

**Idempotency**: middleware reads `Idempotency-Key`; if `(user_id,key)` exists return stored response; else run the handler, store `status_code + response`.

## Workers (same binary, started from `main`)

| Worker | Loop | Notes |
|---|---|---|
| Billing | cron `BILLING_CRON`, calls `billing.RunBilling(today)` | safe with N replicas (SKIP LOCKED); also callable from `POST /billing/run` |
| Mail | every 5s: `SELECT … FROM email_outbox WHERE status='pending' AND next_attempt_at<=now() ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED` | send via `net/smtp`; success → `sent`; failure → `attempts++`, backoff `2^attempts` min, `failed` after 5 |
| Janitor | hourly | delete `idempotency_keys` older than 48h, `password_resets` older than 7d |

## Conventions

- `context.Context` first arg; request-scoped timeout 10s; DB statement timeout 5s.
- Structured logs (`log/slog`) with `request_id`, `user_id`, `route`, `ms`. Never log passwords, tokens, or full bodies.
- Pool: `DB_MAX_CONNS` default 20. Graceful shutdown on SIGTERM (finish in-flight, stop workers).
- No global state besides the pool and config. No `init()` magic.
- Handlers return early on validation failure with all field errors at once, not the first only.
- Table-driven tests next to the code. Integration tests use a throwaway database created from the migration.

## Seed command (`cmd/seed`)

Creates a realistic business **through the services** (same validation as production): admin, staff, ~30 customers with sign-up accounts, products with variants, plans, taxes, templates, discounts, subscriptions in every status, then runs the billing engine and records payments on a share of invoices. Prints the three demo logins. Idempotent: refuses to run if users exist unless `--reset` on a dev database. **The frontend never contains data; this command is the only source of demo data.**

## Build and run

```
docker compose up -d            # postgres + mailpit
cp .env.example .env
go run ./cmd/migrate            # applies backend/migrations
go run ./cmd/seed               # demo data via services
go run ./cmd/server             # API + workers on :8080
```
