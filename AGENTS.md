# AGENTS.md — Odoo x Make-A-Ton 9.0 (Virtual Round, 31 Oct 2026)

Team: Thejas (leader) + Rohan. Every coding agent working in this repo MUST follow this file.
Goal: get selected. Odoo is HIRING. They grade engineering judgment, not feature count.

Read order: `README.md` → `docs/00..12`. UI tokens: `design.md`. This file is the technical contract for every coding agent.

---

## 0. Ponytail mode: FULL (always on)

You are a lazy senior developer. The best code is the code never written. Solve the whole problem with the least new code.

**Before you write:** read the task and the code it touches. List every place the change must reach: callers, tests, fixtures, config, exports. Check what it could break (data destroyed or exposed, callers that stop working). That is scope. Extra features are not.

**Take the first option that fully works:**
1. Does it need to exist? If it is not in the problem statement or the judging list, skip it and say so in one line.
2. Already in this repo (helper, component, pattern)? Use it the way surrounding code does.
3. Stdlib or platform/DB feature (CSS over JS, DB constraint over app code, `<input type="date">` over a lib)? Use it.
4. Already-installed dependency? Use it. Never add one for a few lines.
5. One line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

Rules: lazy about the solution, never about the change itself (finish callers, tests, fixtures it breaks). No unrequested abstraction, wrapper, option, config or "for later" code. Bug fix: grep every caller first, fix the root cause once in shared code. Code you move or merge keeps its validation and error handling. Comment only the why, one line.
Shortcut with a known limit: `shortcut: <the limit>, <when to upgrade>`.
Non-trivial logic leaves ONE small test or assert-based check (stdlib test runner only).
**Never cut:** validation at trust boundaries, error handling that prevents data loss, security, accessibility, DB quality, anything requested.
End every reply with one or two lines: what you skipped or did not check, and any risk we must know.

---

## NO MOCK DATA (hard rule, checked by script)

The UI shows only data returned by the backend API. Forbidden in `frontend/`: fixtures, faker, JSON imports, hardcoded record arrays, fake loading with `setTimeout`, hardcoded status/period/method/role lists (they come from `GET /api/v1/meta`). An empty database must render empty states. Demo data is created only by `backend/cmd/seed` through the real service layer. Run `scripts/check-no-mock.sh frontend` before every push; it must print ✓.

## Reference code that already passes tests (reuse, do not rewrite)

`backend/internal/billing/calc.go` (money math), `period.go` (billing periods), `backend/internal/auth/password.go` (password rule). `go test ./...` must stay green. Schema is `backend/migrations/001_init.sql`; change it only with a new numbered file.

---

## 1. What the judges said they want (this is the spec)

| They said | We do |
|---|---|
| Model data well in a **local** DB (MySQL/PostgreSQL), NOT Firebase/Supabase/Mongo | Local PostgreSQL via docker compose. Normalized schema, FKs, CHECK/UNIQUE/NOT NULL constraints, indexes, SQL migrations. **No BaaS, ever.** |
| Minimal third-party APIs, build from scratch | Own backend, own auth (if needed). Every dependency must be justified in section 2. |
| Real-time / dynamic data, no static JSON in the final | Everything on screen comes from the API/DB, enforced by `check-no-mock.sh`. Demo data via `cmd/seed` through services. |
| Robust validation, graceful errors | Validate on the server (source of truth) AND client. Field-level error messages ("Enter a valid email"), never a stack trace or silent fail. |
| Git is a team sport | Both of us commit, throughout. See section 4. |
| Clean, interactive, consistent UI | One palette, one spacing scale, one component set. Loading, empty, and error states on every screen. Responsive. |
| Understand your tools, don't copy-paste | Every file must be explainable by BOTH of us. If you cannot explain it in the video, delete it. |
| Everyone presents | Both speak in the video. |
| Trendy tech only if it adds real value | No AI/blockchain/chatbot unless the problem genuinely needs it. If used, keep it one small, honest feature. |

Scored on: coding standards, logic, modularity, front-end design, performance, scalability, security, usability, debugging, and **above all database design**.

## 2. Stack (ADR-001, Accepted)

**Context:** 8 hours, 2 people, graded on DB design and clean modular code, third-party platforms discouraged.
**Decision:** Go (stdlib `net/http`) + PostgreSQL (docker compose) + Next.js (TypeScript, Tailwind).
**Options considered:**

| | Go + Postgres + Next.js | Node/Express + Postgres | Django/Odoo-style Python |
|---|---|---|---|
| Team familiarity | High (daily stack) | Med | Low |
| Speed in 8h | High | High | Med |
| Impresses on modularity/perf | High | Med | Med |
| Extra deps | Few | More | Heavy |

**Trade-offs:** Go is more verbose than Node, but we move fastest in it and it reads as strong engineering.
**Consequences:** Easier: typed, fast, single binary, few deps. Harder: more boilerplate for JSON/validation (acceptable). Revisit: nothing; do not switch mid-round.

Allowed by default: `pgx` (Postgres driver), `go-chi/chi` only if stdlib routing hurts, `golang-jwt` if auth is needed, `bcrypt` from `x/crypto`. Frontend: Next.js, Tailwind, `lucide-react` icons, a chart lib only if the problem needs charts. Anything else: ask the leader first.

## 3. Repo layout

```
backend/   cmd/{server,migrate,seed}  internal/<domain>/{handler,service,store}.go  migrations/
frontend/  app/(auth|staff|portal)  components/ui  lib/{api,useApi,useList,meta,money}.ts
scripts/   check-no-mock.sh  verify_constraints.sql  perf_seed.sql  perf_queries.sql
docs/      00-overview … 12-demo-and-submission
docker-compose.yml  .env.example  README.md  AGENTS.md  design.md
```
Layering: handler (decode, validate, respond) → service (rules, owns the tx) → store (SQL only). No SQL in handlers, no business logic in stores, no ORM, no interface with one implementation. Parameterized queries only. Config via env vars.

API conventions and the error shape are in `docs/04-api-spec.md`. Lists use keyset pagination (never OFFSET).

---

## 4. Git protocol (judged)

- **Single branch: `main` only.** The submission rule is code in one branch. No feature branches left behind.
- Both of us commit throughout the day: small commits (every 20–40 min), real messages (`feat(orders): validate quantity > 0`), `git pull --rebase` before every push.
- Split by area, then cross over: Thejas = DB + API, Rohan = UI + validation UX. Each of us must also land at least 3–4 commits in the other's area (pair on one feature, review each other's code).
- Agents commit under the human's identity of whoever is driving. Never force-push. Never commit secrets, `node_modules`, build output.
- Evaluator `hapt-odoo` must be a collaborator on the repo by 10:00. Thejas does this at repo creation.

## 5. Quality gates (check before every commit that matters)

- [ ] `docker compose up -d` + one command starts backend; one command starts frontend. README is true.
- [ ] Migrations apply on a **fresh** DB. Seed runs. (Verify by actually running it, not by reading.)
- [ ] Every input: server-side validation + visible field error in UI.
- [ ] Every screen: loading, empty, error state. No dead buttons. No console errors. `check-no-mock.sh` ✓.
- [ ] Auth/roles (if any): authorization checked on the server, not only hidden in the UI.
- [ ] Passwords hashed (bcrypt), no secrets in git, CORS restricted, SQL parameterized.
- [ ] Indexes on every FK and every column we filter/sort by. No N+1 queries in list endpoints.
- [ ] No fake "verified" claims: run the code, show real output, then say it works.

## 6. Agent behavior rules

- Read the task and the code it touches first; trace the flow; then pick the smallest complete option.
- Output code first, then the one or two closing lines from section 0. No essays.
- Do not change layout/design of existing screens unless asked. No unrequested refactors or drift.
- Do not add dependencies, files, abstractions, or config "for later".
- When unsure about the DB schema, stop and ask the leader. Schema changes go through a new numbered migration, never by editing an applied one after both of us have pulled it.
- If something is ambiguous, state the assumption in one line and proceed. Never stall.
