# 08 — Scalability plan

Principle: do the cheap things now that keep the design honest at 100× the size, and write down the next step so nobody has to guess.

## What is built in from day one

| Concern | Built-in answer |
|---|---|
| API scale-out | stateless Go API; session in a signed cookie; any number of replicas behind a load balancer |
| Billing scale-out | `FOR UPDATE SKIP LOCKED` workers: add workers, get disjoint work, still exactly-once per period |
| Deep lists | keyset pagination, never OFFSET; every filter has a matching `(col, id DESC)` index |
| Hot dashboards | stored invoice totals + `INCLUDE`d payment index → sums are index-only scans; partial indexes keep "open invoices" and "due subscriptions" tiny |
| Search | trigram GIN indexes instead of `LIKE` scans |
| Email | outbox + retrying worker; mail outage cannot slow or fail business transactions |
| Duplicate submits | idempotency keys on money-moving POSTs |
| Data integrity at any size | constraints in the database, not only in code |
| Slow request protection | 10s request timeout, 5s statement timeout, 1 MB body cap, rate limits on auth |
| Observability | request id on every log line, slow-query log (`log_min_duration_statement=200ms`), `pg_stat_statements` |

## Measured today

5,000 subscriptions, 20,000 invoices, 11,666 payments on one local Postgres: every dashboard, list and search query returned in under 8 ms (table in `02-database.md`). Method: `scripts/perf_seed.sql` then `scripts/perf_queries.sql`. Re-run at the end of the hackathon and put the new numbers in the README. To test bigger, raise the `generate_series` limits (the script is the only knob).

## Growth ladder (what to do when, with the trigger)

| Trigger | Action | Cost |
|---|---|---|
| p95 of any list > 500 ms | `EXPLAIN (ANALYZE, BUFFERS)`, add or fix the index | minutes |
| invoices > ~10M rows | partition `invoices` by `period_start` (monthly) so the `UNIQUE (subscription_id, period_start)` guard still contains the partition key, and `payments` by `paid_on` | one migration |
| dashboard sums slow at that size | `revenue_daily(day, amount_minor, count)` rollup updated in the payment transaction; reports read the rollup | small table, one write |
| API CPU bound | add replicas; pool per replica = `DB_MAX_CONNS`, put PgBouncer (transaction mode) in front when replicas × pool > Postgres limit | config |
| reports compete with writes | route `/reports/*` to a read replica | config |
| billing window too long | run more billing workers, shard by `id % N` | config |
| mail volume | more mail workers (SKIP LOCKED already makes it safe) | config |
| multi-tenant SaaS later | add `org_id` to every table and a leading column on every index; Postgres row-level security as the safety net | planned migration |

## Billing capacity method (do not guess, measure)

`POST /billing/run` returns timings; in the perf database set 5,000 subscriptions due today and time `RunBilling`; record invoices/second per worker; then run 2 and 4 workers and confirm throughput scales and the invoice count equals the number of due subscriptions. Put the three numbers in the README.

## Things we deliberately did not build (and why that is fine)

Queue broker (Postgres outbox is enough), cache layer (queries are single-digit milliseconds; only `/meta` is cached), microservices (one transaction boundary is the feature), event sourcing (the `subscription_events` and `audit_log` tables give the audit trail we need).
