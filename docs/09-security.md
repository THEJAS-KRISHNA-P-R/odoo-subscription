# 09 — Security checklist

| Area | Requirement | Where |
|---|---|---|
| Passwords | bcrypt cost 12; rule > 8 chars + upper + lower + special; never logged or returned | `auth` |
| Sessions | JWT in httpOnly, Secure, SameSite=Lax cookie, 8h; logout clears; deactivated user rejected on next request (role/active re-read for admin routes) | `auth` |
| Reset | 32 random bytes, only SHA-256 stored, 30 min, single use; same 202 response whether or not the email exists; old tokens invalidated on new request | `auth` |
| Brute force | login and forgot rate-limited per IP + email; generic "Invalid email or password" | `httpx` |
| Authorization | every route declares its roles; customers always scoped by their own `customer_id` in the store; 404 (not 403) for other people's records | `httpx`, stores |
| CSRF | SameSite=Lax + JSON content-type required on writes + CORS limited to `APP_URL` | `httpx` |
| Injection | parameterized queries only (`$1`), no string-built SQL; enums validated against `meta` | stores |
| Input | 1 MB body cap, unknown JSON fields rejected, string length caps, trimmed | handlers |
| Output | error shape never leaks SQL or stack traces; request id for support | `httpx` |
| XSS | React escaping; no `dangerouslySetInnerHTML`; email bodies built from escaped values | frontend, `mail` |
| Headers | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, basic CSP on the web app | Next config |
| Secrets | env vars only; `.env` ignored by git; `.env.example` has no real values | repo |
| Money integrity | integer math + DB CHECKs + row locks on payment and billing | `billing`, `payments` |
| Audit | `audit_log` rows for: staff created, discount changed, billing run, invoice confirm/cancel/send, payment recorded, role/active change | services |
| Least privilege | the app's DB user cannot `DROP`/`CREATE`; migrations run with a separate owner role (note for deploy) | ops |
| Dependencies | few, pinned, justified; `go mod verify`, `npm audit` before submission | repo |

## Abuse cases to test by hand before the video

1. Customer A requests `/me/invoices/{B's id}` → 404.
2. Staff calls `POST /discounts` → 403. Staff calls `POST /staff` → 403.
3. Edit `role` in the sign-up request body → ignored, user is `customer`.
4. Replay a used reset link → 422 "link already used".
5. Submit the same payment twice with one idempotency key → one payment.
6. Pay more than outstanding → refused. Cancel a paid invoice → refused.
7. SQL metacharacters in search box → no error, no extra rows.
