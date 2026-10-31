# 11 — Work plan (31 Oct 2026, IST)

Clock: statements 09:00 · evaluator `hapt-odoo` added by 10:00 · coding ends 17:00 · **freeze 16:30** · video link by 17:30.
If you start late, keep the block order and compress the earlier blocks; never drop the cut line (below).

## Roles

Thejas = database, API, billing, workers. Rohan = UI, validation UX, portal, print. Each lands real commits in the other's area at B6. Both on `main`, small commits, `git pull --rebase` before push.

## Blocks

| Block | Thejas | Rohan | Done when |
|---|---|---|---|
| **B0** 09:20–10:00 | repo, compose (postgres + mailpit), copy `001_init.sql`, migration runner, add `hapt-odoo`, healthz | Next scaffold, Tailwind tokens from `design.md`, shell (sidebar, top bar), `Pill`, `Field`, `Drawer`, `Modal`, `Skeleton`, `EmptyState` | `docker compose up` + migrate + both apps boot; collaborator added |
| **B1** 10:00–11:15 | auth (signup, login, reset), RBAC middleware, error writer, `/meta`, staff create, tests T1 T2 T3 | auth screens with live `PasswordChecklist`, `lib/api.ts`, `meta` provider, role-aware nav | sign up, log in, reset via Mailpit, three roles land on right home |
| **B2** 11:15–12:45 | taxes, payment terms, products + variants, plans, templates (+instantiate) | Catalog screens (list + drawer forms), plan flag toggles | admin creates Odoo-brand variant +₹560 and a plan; staff sees read-only |
| **B3** 12:45–14:15 | customers, subscriptions + state machine + events, **billing engine + `calc`**, tests T4 T5 T6 T8 | Subscriptions list, drawer, new-subscription stepper | quote → active; "Run billing" creates invoices; second run creates 0 |
| **B4** 14:15–15:15 | discounts + auto-apply, invoice actions, outbox + mail worker, payments, tests T7 T9 T10 | Invoices, Payments, Discounts screens, print CSS | discount shows on next invoice; partial → paid |
| **B5** 15:15–16:00 | reports endpoints, `cmd/seed` through services, perf run (5k/20k), fix slow queries, T11 T12 | Home, Insights, Portal, state pass (skeleton / empty / error everywhere) | dashboard < 2s on big data; `check-no-mock` ✓ |
| **B6** 16:00–16:30 | swap and review each other's code, README + ERD, final gate | same + rehearse demo | final gate all green |
| **16:30** | **FREEZE**: bug fixes only | | |
| 16:30–17:15 | record video (both speak) | | |
| 17:15 | submit repo link, then video link; open both logged out to verify | | |

## Cut list (drop from the bottom; never above the line)

1. Must ship: auth + RBAC, catalog + variants, plans, subscriptions + lifecycle, billing engine, invoices, payments, finance dashboard, no-mock rule.
2. Should ship: discounts + auto-apply, taxes, templates, customer portal, outbox mail.
- ——— cut line ———
3. Nice: revenue chart (use metric cards instead), overdue "Chase" mail, renew flow, pause, print polish, audit viewer.

## Definition of done per task

Code merged on `main` · a test or a command output proves it · every UI state handled · field errors shown · `check-no-mock` ✓ · one-line note in the commit message of what it does.

## Agent task card (paste to a coding agent)

```
Task: <one sentence>. Read AGENTS.md and the relevant doc (03 rules / 04 API / 07 UI).
Scope: only files for this task. Reuse billing.Compute / auth.ValidatePassword; do not rewrite them.
No mock data. Money in minor units. SQL parameterized. Validation server-side + field errors.
Finish with: files changed, command output proving it works, what you skipped and any risk.
```
