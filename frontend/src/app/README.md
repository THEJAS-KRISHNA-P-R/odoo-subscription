# Application Routes (`/app`)

The application is organized into three role-aware route groups mirroring the workflows in *A Month at Brightloop*:

## 1. Authentication (`app/(auth)`)
- **`/login`**: Authenticates staff, admins, and customers (`POST /auth/login`), reloads `GET /meta`, and routes customers to `/portal/home` and staff/admins to `/home`.
- **`/signup`**: Self-service customer registration (`POST /auth/signup`) with live password complexity verification.
- **`/forgot` & `/reset`**: Password reset link request (`POST /auth/forgot`) and token-based password update (`POST /auth/reset`).

## 2. Staff & Admin Workspace (`app/(staff)`)
Wrapped by `app/(staff)/layout.tsx`, featuring a collapsible sidebar (`Alt+B`), inline quick-search bar with extending dropdown (`Ctrl+K`), theme toggle (`Light / Dark / System`), and role-based navigation:
- **`/home`**: Operational command center with active subscription, revenue, outstanding, and overdue bento metrics, one-click **Generate due invoices** (`POST /billing-runs`), and recent activity lists.
- **`/subscriptions`**: Filterable subscription list (`GET /subscriptions`), status pill tabs from `GET /meta`, creation modal, and detail drawer.
- **`/invoices`**: Filterable invoice list (`GET /invoices`), overdue filter, CSV export (`GET /invoices?format=csv`), and detail drawer.
- **`/payments`**: Payment ledger (`GET /payments`) with payment method filtering and **Record payment** modal.
- **`/customers`**: Customer directory (`GET /customers`) with slide-over detail drawer showing linked subscriptions and invoices.
- **`/catalog/{products,plans,templates,taxes,discounts}`**: Unified catalog configuration with shared `<CatalogSubnav />` for managing products & attribute variants, billing plans, quotation templates, basis-point tax rates, payment terms, and scoped discounts.
- **`/insights`**: Financial analytics with date-range presets, SVG monthly revenue chart, invoice status breakdown, and overdue aging list with one-click **Send reminder** (`POST /invoices/{id}/send`).
- **`/team`**: Admin-only staff directory and provisioning (`GET /staff`, `POST /staff`, `PATCH /staff/{id}`).
- **`/settings`**: Appearance theme selector (`Light`, `Dark`, `System`), sidebar layout toggle, keyboard shortcut reference, account capabilities (`GET /auth/me`), and live API health status (`GET /healthz`).

## 3. Customer Self-Service Portal (`app/(portal)`)
Wrapped by `app/(portal)/layout.tsx`:
- **`/portal/home`**: Customer welcome hero, active subscription spotlight, and recent invoices.
- **`/portal/subscriptions`**: Self-service subscription list (`GET /me/subscriptions`) with plan-governed pause, resume, close, and renew actions.
- **`/portal/invoices`**: Customer invoice history (`GET /me/invoices`) with printable invoice drawer.
- **`/portal/profile`**: Customer contact & billing address management (`PATCH /me/profile`) and password reset trigger.
