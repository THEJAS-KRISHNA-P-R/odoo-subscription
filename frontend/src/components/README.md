# Component Library (`/components`)

All UI primitives and domain-level drawers/modals are custom-built with React, TypeScript, Tailwind CSS, and `lucide-react` icons without external UI kits or chart libraries.

## `/components/ui` — Design System Primitives

- **`Pill.tsx`**: Pill-shaped action button (`rounded-full`) with `primary`, `soft`, `outline`, `ghost`, and `danger` variants and built-in loading spinner state.
- **`CircleAction.tsx`**: Circular icon + label quick action control used in workspace headers.
- **`BentoHero.tsx` & `BentoMetric.tsx`**: High-craft bento metric cards displaying primary KPIs with `tabular-nums`.
- **`DashedActionCard.tsx`**: Dashed-border interactive card for secondary workflows.
- **`GroupedRow.tsx` & `DataList.tsx`**: Hairline-divided row containers with built-in keyset pagination (`Load more`), `Skeleton` loading placeholders, `ErrorState` with retry, and `EmptyState` with primary CTA.
- **`StatusBadge.tsx`**: Semantic status pill conveying state via both text label and color tokens.
- **`Drawer.tsx` & `Modal.tsx` & `ConfirmModal.tsx`**: Accessible slide-over drawers and centered dialogs supporting `Esc` key dismissal, backdrop click, body scroll lock, and sticky action footers.
- **`Field.tsx`**: Accessible form inputs (`Field`, `SelectField`, `TextareaField`) with explicit `<label htmlFor>`, `aria-invalid`, and field-level server validation error messages.
- **`PasswordChecklist.tsx`**: Live 4-rule password validation checklist (`> 8 chars`, uppercase, lowercase, special character).
- **`BarSeries.tsx`**: Hand-written responsive SVG bar chart for monthly revenue series.
- **`CommandPalette.tsx`**: Wide inline header search bar (`Ctrl+K`) with an extending dropdown list for instant keyboard navigation across all staff views.

## `/components/domain` — Reusable Domain Workflows

- **`SubscriptionDrawer.tsx`**: Inspects a subscription (`GET /subscriptions/{id}`), renders a 5-stage lifecycle progress stepper (`Draft → Quotation → Confirmed → Active → Closed`), supports inline editing for draft/quotation dates (`PATCH /subscriptions/{id}`), and executes server-authorized transitions (`POST /subscriptions/{id}/transition`).
- **`NewSubscriptionModal.tsx`**: Creates a subscription (`POST /subscriptions`) from scratch or pre-filled from a quotation template (`GET /templates`), with live integer minor-unit line and tax calculation.
- **`InvoiceDrawer.tsx`**: Displays invoice details (`GET /invoices/{id}`), lifecycle stage stepper (`Draft → Confirmed → Paid`), print-ready layout, confirmation/cancellation/email actions, and payment recording.
- **`RecordPaymentModal.tsx`**: Records full or partial payments (`POST /payments`) against confirmed invoices using integer `paise` math.
- **`CatalogSubnav.tsx`**: Horizontal pill navigation bar shared across all `/catalog/*` pages.
