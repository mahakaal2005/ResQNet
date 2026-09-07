# auth (owner: Charan)

`POST /auth/login`, `POST /auth/refresh` — JWT issuance/expiry, RBAC.
Table: `users`. Mock fixture: `packages/contracts/mocks/mock_users.json`.

- `password.ts` — scrypt from `node:crypto`, so the API image needs no native
  build step. Format `scrypt$salt$hash`.
- `jwt.config.ts` — secret and TTLs in one place (access 15m, refresh 7d).
  There is no `refresh_tokens` table: Section 11 assigns this track four
  tables, so the refresh token is a stateless JWT distinguished by a `typ`
  claim, and every refresh re-reads the user row.
- `rbac.ts` — the role → permission matrix. `viewer` is strictly read-only;
  `operator` runs missions; `admin` adds user management.
- `jwt-auth.guard.ts` + `permissions.guard.ts` + `@Permissions(...)` — how
  every other module protects a route. `AuthModule` is `@Global`, so no module
  has to import auth to use them.
