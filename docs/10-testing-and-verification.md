# 10 — Testing and verification

"Done" means the command was run and the output was seen. No claims without output.

## Already verified in this pack

| Check | Command | Result |
|---|---|---|
| Money math (worked example 390344, discount floor, exact split, DB identity, month-end periods) | `cd backend && go test ./...` | PASS |
| Password rule (8 fails, 9 with upper/lower/special passes) | same | PASS |
| Schema applies to an empty Postgres 16 | `psql -f backend/migrations/001_init.sql` | 23 tables, 51 indexes |
| 13 rules refused by the database | `psql -f scripts/verify_constraints.sql` | 13 ERRORs, as required (incl. duplicate billing period) |
| Query speed at 5k subs / 20k invoices | `psql -f scripts/perf_queries.sql` | all < 8 ms |
| No-mock checker catches and passes | `scripts/check-no-mock.sh frontend` | ✗ on bad sample, ✓ on clean |

## Tests the team must add (each is a real assertion, written as the feature lands)

| # | Test | Asserts |
|---|---|---|
| T1 | signup validation | weak password → 422 with the right message; duplicate email in other case → 422 `fields.email` |
| T2 | RBAC | customer cannot read another customer's invoice (404); staff cannot create discount or staff (403); signup cannot set role |
| T3 | reset flow | token works once, expires, unknown email gives same 202 |
| T4 | subscription transitions | every allowed transition passes, every other returns 409; plan flags respected (pause on non-pausable → 409) |
| T5 | **billing idempotency** | N due subs → run → N invoices; run again → 0 created; run twice concurrently → still N |
| T6 | billing catch-up | sub due 3 periods ago → 3 invoices, correct period dates, `next_billing_date` in the future |
| T7 | discount auto-apply | applies on next invoice; stops at `usage_limit`; stops after `end_date`; released on cancel |
| T8 | tax | amounts equal `billing.Compute` for the same inputs |
| T9 | payments | partial then exact → `paid`; overpay → 422; cancel with payment → refused |
| T10 | outbox | reset and send-invoice create outbox rows in the same tx; failed send retries with backoff |
| T11 | reports | summary numbers equal an independent SQL sum over the seeded data |
| T12 | keyset lists | pages never overlap or skip when rows are inserted between requests |

Integration tests create a throwaway database from `001_init.sql`, run in a transaction or truncate between tests.

## Final gate (run in this order at 15:30 and again at 16:30)

```
go vet ./... && go test ./...                       # backend green
scripts/check-no-mock.sh frontend                   # ✓ no mock data
psql -d brightloop_perf -f scripts/verify_constraints.sql   # 13 ERRORs (needs perf_seed.sql loaded)
fresh DB → migrate → seed → run billing → run billing again   # second run created 0
npm run build                                       # no type errors
manual: the 7 abuse cases in 09-security.md
manual: click every screen; each shows skeleton, empty (on a fresh DB), error (stop the API), data
perf: re-run scripts/perf_queries.sql on the 5k/20k database, paste timings in README
```
