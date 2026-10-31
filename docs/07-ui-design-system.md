# 07 — UI design system and screens

Source of truth: `design.md` (tokens, radii, shadows, motion, component CSS) and the three Wise screenshots. **Copy values, do not invent.** This file says where each component is used and which endpoint feeds it.

## Look in one paragraph

Fluffy, mellow, clean: white canvas, soft grey surfaces (`#F4F5F5`), almost no borders, 16–24px radii, pill buttons in Wise lime `#9FE870` with forest text `#163300`, pastel hero cards, dashed action cards, generous whitespace (40px between modules, 48px page gutters), slide-over drawers instead of page jumps, motion 140–220ms with `cubic-bezier(0.16,1,0.3,1)`.

## Layout numbers (from design.md)

| Part | Value |
|---|---|
| Sidebar | 240px sticky; logo padding `28px 24px 20px`; nav item 44px high, pill radius; active = `#F4F5F5` pill, weight 600; sub-items indent 44px |
| Top bar | 64–72px, white; breadcrumb left; pills + notification + avatar badge right |
| Canvas | max-width 1200px, padding `40px 48px 120px`, 40px gap between modules |
| Cards | hero 24px radius, grouped row 16px, inner 12px, inputs 10px |
| Drawer | 560px, right, portaled to `body`, scrim `rgba(15,23,42,.4)` + 4px blur |
| Modal | 560 / 720px, 24px radius, padding `36px 40px` |

## Components and where they are used

| Component | Use |
|---|---|
| `BentoHero` (pastel) | home: "Run today's billing"; portal: next invoice due |
| `BentoMetric` (grey) | home and insights metrics |
| `DashedActionCard` | home quick actions; catalog landing |
| `GroupedRow` list | every list (subscriptions, invoices, payments, customers) instead of bordered tables |
| `StatusBadge` | status pills; colours below |
| `Drawer` | detail views (subscription, invoice, customer, product) |
| `Modal` | create flows and confirmations (stepper for new subscription) |
| `Pill` primary / soft / outline | actions |
| `EmptyState`, `ErrorState`, `Skeleton`, `Toast` | the four states |

**Status colours:** draft grey · quotation blue · confirmed purple · active lime tint · paused amber · closed dark grey · paid lime · cancelled grey strike · overdue red. 12px / 600 / pill.

## Screens and their data sources

| Screen | Widgets | Data from |
|---|---|---|
| Login / Sign-up / Forgot / Reset | centred 440px card on `#F8FAFC`; `PasswordChecklist`; field errors | `/auth/*` |
| **Home (staff)** | yellow hero + "Run billing" pill (shows `created / skipped / closed`); 4 metric cards; 3 dashed action cards; recent invoices | `POST /billing/run`, `/reports/summary`, `/invoices?limit=5` |
| Subscriptions | filter pills (from `meta.enums.subscription_status`), search, grouped rows, "New subscription" | `/subscriptions` |
| Subscription drawer | lines, totals, timeline, action pills built from `meta.subscription_transitions` and plan flags | `/subscriptions/{id}`, `/events` |
| New subscription (stepper modal) | customer → template or plan → lines with variant picker and live price → terms and dates | `/customers`, `/templates`, `/plans`, `/products` |
| Invoices | pills All / Draft / Confirmed / Paid / Overdue, search, rows | `/invoices` |
| Invoice drawer | lines, discount, tax, totals, payments, actions Confirm / Cancel / Send / Print / Record payment | `/invoices/{id}` |
| Payments | list; "Record payment" modal (method from meta, amount prefilled with outstanding) | `/payments`, `POST …/payments` |
| Customers | list, search, drawer with their subscriptions and invoices | `/customers` |
| Catalog: Products | list + drawer with variants sub-list | `/products`, `/…/variants` |
| Catalog: Plans, Templates, Taxes, Discounts | list + drawer form; discount form shows usage meter (`used_count / usage_limit`) | respective endpoints |
| **Insights** | summary bento; revenue-by-month SVG bars; range pills; overdue list with "Chase" (queues reminder mail) | `/reports/*` |
| Team (admin) | account owner row + members, "Add team member" modal (as in the Wise screenshot) | `/staff` |
| **Portal** | hero "Next invoice due"; subscription cards with allowed actions; invoices list and printable view | `/me/*` |

## Forms (all)

Label above input, 10px radius, 44px height, error text 12px danger colour under the field, help text muted. Primary pill bottom-right, ghost "Cancel" left of it. Submit shows a spinner and disables. Required fields marked in the label.

## Charts

One component, `BarSeries`, hand-written SVG: bars with 12px radius caps, lime fill, hover tooltip, axis labels from the response. If the series is empty show the empty state, never a fake flat chart.

## Responsive

≥1024px full shell; 768–1023px sidebar collapses to icons; <768px sidebar becomes a bottom sheet menu, drawers go full width, cards stack to one column.
