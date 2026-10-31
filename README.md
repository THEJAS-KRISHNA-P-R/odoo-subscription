# Brightloop Subscription Management System — Build Pack

Odoo x Make-A-Ton 9.0 · virtual round · Team Thejas + Rohan.
Problem: run plans, subscriptions, invoices, payments and revenue reporting in one place.

**Three rules that decide everything:** (1) the database refuses bad data, (2) billing can never bill twice or skip, (3) **no mock data**: the UI shows only what the backend returns.

## Read in this order (≈ 25 minutes)

| # | File | You learn |
|---|---|---|
| 1 | `docs/00-overview.md` | users, jobs, coverage map, decisions D1–D12 |
| 2 | `docs/01-architecture.md` | stack, ADRs, how pieces fit |
| 3 | `docs/02-database.md` + `backend/migrations/001_init.sql` | schema, rules the DB enforces, index catalog, measured timings |
| 4 | `docs/03-business-rules.md` | state machines, pricing/discount/tax order, billing engine, roles |
| 5 | `docs/04-api-spec.md` | every endpoint, error shape, validation rules |
| 6 | `docs/05-backend-guide.md` · `06-frontend-guide.md` · `07-ui-design-system.md` | how to implement; `design.md` has the Wise tokens |
| 7 | `docs/08-scalability.md` · `09-security.md` · `10-testing-and-verification.md` | scale, safety, proof |
| 8 | `docs/11-work-plan.md` · `12-demo-and-submission.md` | who does what when; video and submission |
| — | `AGENTS.md` | the contract every coding agent follows (paste its path into each agent) |

## Quick start (once the code exists)

```
docker compose up -d && cp .env.example .env
go run ./cmd/migrate && go run ./cmd/seed && go run ./cmd/server     # backend/
npm run dev                                                          # frontend/
```

## What is already built and verified in this pack

| Item | Proof |
|---|---|
| `backend/migrations/001_init.sql` | applied to an empty PostgreSQL 16: 23 tables, 51 indexes |
| `scripts/verify_constraints.sql` | 13 invalid operations, all refused by the database (including a duplicate billing period) |
| `scripts/perf_seed.sql` + `perf_queries.sql` | 5,000 subs / 20,000 invoices / 11,666 payments; slowest query 7.1 ms |
| `backend/internal/billing` (`calc.go`, `period.go`) | `go test` PASS: worked invoice = ₹3,903.44, discount floor, exact pro-rata split, month-end periods |
| `backend/internal/auth/password.go` | `go test` PASS: 8 chars fails, 9 with upper/lower/special passes |
| `scripts/check-no-mock.sh` | fails on a mock sample, passes on a clean one |

Not verified here (needs your machine): `docker-compose.yml`, anything under `frontend/`, and all HTTP code, which does not exist yet.

## Layout

```
README.md  AGENTS.md  design.md  docker-compose.yml  .env.example  .gitignore
docs/      00 … 12
backend/   go.mod  migrations/001_init.sql  internal/{billing,auth}/ (tested reference code)
scripts/   check-no-mock.sh  verify_constraints.sql  perf_seed.sql  perf_queries.sql
tools/     ponytail.skill   (install in Claude to get lazy-senior-dev mode)
```
