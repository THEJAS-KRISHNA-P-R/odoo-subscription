# Core Library Layer (`/lib`)

This directory contains pure business logic, the single HTTP gateway, reactive data-fetching hooks, server metadata providers, routing, and appearance theming.

## Modules

- **`api.ts`**:
  The sole module permitted to call `fetch`. Reads `NEXT_PUBLIC_API_URL` / `VITE_API_URL` (defaulting to `http://localhost:8080/api/v1`), sets `credentials: 'include'`, parses JSON responses, throws typed `ApiError` (`{ status, error, message, fields }`) on non-2xx responses, redirects to `/login` on `401` outside auth routes, and provides `api.download()` for streaming CSV exports (`/invoices?format=csv`).
- **`useApi.ts`**:
  Generic reactive hook `useApi<T>(path)` returning `{ data, error, loading, reload }` with automatic cancellation on unmount or path change.
- **`useList.ts`**:
  Keyset pagination hook `useList<T>(path, filters, limit)` managing cursor-based pages (`items`, `nextCursor`, `loading`, `loadingMore`, `error`, `loadMore()`, `reset()`).
- **`meta.tsx`**:
  Loads `GET /meta` once at startup and exposes `useEnum(name)`, `useTransitions()`, `useMe()`, and `useCan(capability)`.
- **`money.ts` & `money.test.ts`**:
  Pure integer arithmetic and formatting helpers for INR minor units (`paise`), basis points (`bp`), password complexity validation (`checkPasswordRules`), and ISO `YYYY-MM-DD` date utilities. Tested via Node's built-in test runner (`node:test`).
- **`theme.tsx`**:
  Provides `ThemeProvider` and `useTheme()` supporting `'light'`, `'dark'`, and `'system'` modes. Listens to OS-level `prefers-color-scheme: dark` changes in real time when set to `'system'` and toggles `.dark` on `document.documentElement`.
- **`router.tsx`**:
  Lightweight History API router providing `RouterProvider`, `Link`, `useRouter`, `usePathname`, and `useSearchParams`.
- **`types.ts`**:
  Shared TypeScript interfaces for all domain entities (`Product`, `Plan`, `Template`, `Tax`, `PaymentTerm`, `Discount`, `Customer`, `Subscription`, `Invoice`, `Payment`, `ReportSummary`, `StaffMember`).
