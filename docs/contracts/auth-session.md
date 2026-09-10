# Auth Session Contract

**Version: 1.0 · Status: FROZEN for Phase 1.**

Owner: Charan. Consumed by Ayush (login, token refresh, and hiding controls the
caller cannot use). Any shape change requires sign-off before merge and bumps
the version above.

| Version | Change |
|---|---|
| 1.0 | Initial freeze: the token pair, the `typ` claim split, `GET /operators/me`, and the role matrix. |

## Token pair

`POST /auth/login` (`{ email, password }`) and `POST /auth/refresh`
(`{ refresh_token }`) both return **200** with:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": "15m",
  "user": {
    "id": "00000000-0000-4000-8000-000000000002",
    "email": "operator@resqnet.demo",
    "role": "operator"
  }
}
```

200, not 201 — logging in creates no resource.

`expires_in` is the access token's TTL **as a span string** (`'15m'`), not a
number of seconds, because that is what the signer is configured with. Do not
parse it as an integer; read the JWT's `exp` claim if an exact instant is
needed.

Send the access token as `Authorization: Bearer <access_token>` on every other
endpoint.

## Claims

```json
{ "sub": "<users.id>", "email": "...", "role": "operator", "typ": "access", "iat": 0, "exp": 0 }
```

`typ` is the only thing separating the two tokens: `access` (15m) is the only
one any guarded endpoint accepts, `refresh` (7d) is accepted only by
`POST /auth/refresh`. Presenting a refresh token as a Bearer token is a 401.

Both TTLs are configurable via `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`.

There is **no `refresh_tokens` table** — Section 11 assigns this track exactly
four tables, so a refresh is stateless. The `users` row is re-read on every
refresh, which is what makes a role change or a deleted account take effect
without server-side session storage. There is correspondingly no logout
endpoint and no revocation; that is a Phase 2 concern.

`JWT_SECRET` falls back to a public, checked-in development secret so the
independent demo runs with no `.env` file. The API refuses to boot with that
fallback when `NODE_ENV=production`.

## Failure shapes

| Case | Status | Note |
|---|---|---|
| Wrong password, or no such account | 401 | Same message for both — an attacker learns nothing about which addresses exist |
| Missing or malformed `Authorization` header | 401 | |
| Expired or invalid access token | 401 | |
| Refresh token presented as a Bearer token | 401 | |
| Valid token, insufficient role | 403 | Message names the missing permission(s) |

A 401 means "log in or refresh"; a 403 means "this account will never be
allowed" — the dashboard should not retry a 403 after a refresh.

## GET /operators/me

```json
{
  "id": "00000000-0000-4000-8000-000000000002",
  "email": "operator@resqnet.demo",
  "full_name": "Sector Operator",
  "role": "operator",
  "permissions": ["mission:read", "sector:read", "audit:read", "operator:read-self",
                  "mission:create", "mission:update-status", "sector:create"],
  "created_at": "2026-08-27T10:29:00.000Z"
}
```

Returns the **permission list**, not just the role, so the dashboard hides
controls the caller cannot use without hard-coding the matrix client-side. Read
`permissions`, not `role`, when deciding whether to render a control.

## Roles

Nested: `viewer ⊂ operator ⊂ admin`.

| Permission | viewer | operator | admin |
|---|:--:|:--:|:--:|
| `mission:read` | ✓ | ✓ | ✓ |
| `sector:read` | ✓ | ✓ | ✓ |
| `audit:read` | ✓ | ✓ | ✓ |
| `operator:read-self` | ✓ | ✓ | ✓ |
| `mission:create` | | ✓ | ✓ |
| `mission:update-status` | | ✓ | ✓ |
| `sector:create` | | ✓ | ✓ |
| `user:manage` | | | ✓ |

`viewer` is strictly read-only — the district-authority account in PRD
Section 6. Creating and running missions is an operator power rather than an
admin-only one, because Section 27 step 1 puts the operator in the driving
seat. Matrix of record: [`rbac.ts`](../../apps/api/src/auth/rbac.ts).

## Demo accounts

Created by `database/seeds/seed.mjs`, all with password `resqnet-demo`
(override with `SEED_PASSWORD`). Demo credentials, never production ones.

| Email | Role |
|---|---|
| `admin@resqnet.demo` | admin |
| `operator@resqnet.demo` | operator |
| `viewer@resqnet.demo` | viewer |
