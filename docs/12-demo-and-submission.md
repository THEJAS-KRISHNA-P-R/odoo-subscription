# 12 — Demo and submission

## Portal steps (leader only does the submits)

1. Select the problem statement at 09:00 (final, cannot change).
2. Create the repo; **all code on a single branch (`main`)**; add `hapt-odoo` as collaborator by 10:00.
3. "Submit GitHub Repo Link" once the first push is in (you may update it later).
4. At 17:15: "Submit Video Solution". Deadline 17:30. Open both links in a private window to confirm access.
5. Both members must have confirmed participation in the portal.

## Video (5 minutes max, both speak)

| Time | Who | What |
|---|---|---|
| 0:00–0:30 | Thejas | problem, who it is for, one-line solution |
| 0:30–2:00 | Rohan | live demo, real data from the API: sign-up with weak password and duplicate email, staff creating a subscription, Run billing twice (second says 0 created), invoice with discount + tax, partial then full payment |
| 2:00–3:30 | Thejas | schema walk-through (ERD), constraints that refuse bad data (show `verify_constraints` output), why local Postgres and no BaaS, billing engine guarantee, keyset pagination, timings |
| 3:30–4:20 | Rohan | UI system (tokens, states), validation UX, role views, customer portal |
| 4:20–5:00 | Both | decisions D1–D12 in one breath, "no mock data" proof (`check-no-mock` ✓), Git history from both, what we would do next |

Tips: record at 1080p, browser zoom 110%, seeded data already loaded, close notifications, rehearse once.

## What judges will look for → show it

| They look at | Show |
|---|---|
| database design | ERD, constraint list, `verify_constraints` output |
| logic / correctness | billing run twice, worked invoice example |
| modularity / coding standards | folder map, handler → service → store |
| security | RBAC denial, reset flow, hashed tokens |
| performance / scalability | timings table, SKIP LOCKED explanation, growth ladder |
| front-end design | the Wise-style shell, states, print view |
| debugging | one story: a constraint or test that caught a real bug during the day |
| teamwork | commits from both, both speaking |

## README must contain

3-command run, demo logins, ERD, decisions D1–D12, verified outputs (tests, constraint proof, timings), "no mock data" statement, known limits (`shortcut:` list).

## Final round (19–20 Dec, 24 h on-site)

Statement differs. Reuse this pack's scaffolding: auth, RBAC, migration runner, error shape, `useApi/useList`, design system, outbox, idempotency, scripts. Keep `AGENTS.md`; replace `BUILD_PLAN` docs with the new statement's rules.
