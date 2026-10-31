# 06 — Frontend guide (Next.js)

## The one rule: no mock data

Every value on screen comes from an API response. That means:
- no fixtures, no `faker`, no JSON imports, no hardcoded record arrays, no `setTimeout` to fake loading
- domain lists (statuses, billing periods, payment methods, roles, product types) come from `GET /meta`
- an empty database renders **empty states**, not sample rows
- `scripts/check-no-mock.sh frontend` must pass before every push (it fails on the patterns above)

Allowed static text: labels, headings, help copy, and design tokens. Not allowed: any business record or enum list.

## Stack

Next.js App Router + TypeScript + Tailwind (tokens from `design.md` as CSS variables) + `lucide-react` + `Inter` via `next/font`. No UI kit, no state library, no chart library (SVG by hand). Justify any new dependency in the PR message.

## Structure

```
frontend/
  app/
    (auth)/login, signup, forgot, reset
    (staff)/layout.tsx  home, subscriptions, invoices, payments, customers,
                        catalog/{products,plans,templates,taxes,discounts}, insights, team
    (portal)/layout.tsx home, subscriptions, invoices, profile
  components/ui/   Pill, CircleAction, BentoHero, BentoMetric, DashedActionCard, GroupedRow,
                   StatusBadge, DataList, Drawer, Modal, Field, PasswordChecklist, Skeleton,
                   EmptyState, ErrorState, Toast
  lib/api.ts       fetch wrapper (cookies, error shape, idempotency key helper)
  lib/useApi.ts    ~40 lines: { data, error, loading, reload } for GETs
  lib/useList.ts   keyset "load more" over a list endpoint
  lib/meta.ts      loads /meta once, provider + hooks (useEnum, useCan)
  lib/money.ts     formatMinor(n) → "₹3,903.44" via Intl en-IN
```

## Data rules

- **One door**: only `lib/api.ts` calls `fetch`. It sends cookies, parses the error shape, throws `ApiError {status, error, fields}`.
- **Forms**: submit → on `fields`, show each message under its input; on other errors, a toast. Disable submit while pending. Money-moving POSTs send an `Idempotency-Key` generated once per form open.
- **Role-aware UI**: nav and buttons come from `meta.me.capabilities` (`useCan('billing.run')`). This is convenience only; the server enforces.
- **Lists**: `useList(endpoint, filters)` → keyset pages, "Load more" button, filter pills change the query string, server filters. Never sort or filter big sets in the browser.
- **After a mutation**: reload the affected resource from the server (do not patch local state by guessing).
- **Auth guard**: layout fetches `/auth/me`; 401 → redirect to `/login`; wrong role → redirect to its home.

## Required states on every data view

| State | Look |
|---|---|
| loading | `Skeleton` rows with the same height as real rows (no layout jump) |
| empty | friendly sentence + the primary action ("No invoices yet. Run today's billing.") |
| error | `ErrorState` with message and Retry |
| success | real data |
Also: keyboard focus rings, `Esc` closes drawers/modals, `aria-live` on toasts, labels on all inputs, colour never the only signal (badges carry text).

## Client-side validation

Mirrors the server rules for instant feedback (`PasswordChecklist` ticks live: length > 8, upper, lower, special; email shape; required fields; amount ≤ outstanding). The server result always wins and is displayed if different.

## Performance

Server-render the shell; fetch data on the client in parallel; no waterfall (home page fires its 3 requests together); list pages 25 rows; images none; fonts self-hosted; route-level code splitting by default; memoize only measured hot spots.

## Print

Invoice detail has `@media print`: hide sidebar and top bar, A4 margins, black on white, page break avoidance on line rows.
