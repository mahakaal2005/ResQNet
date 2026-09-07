# operators (owner: Charan)

`GET /operators/me` — the signed-in account plus the permission list its role
holds, so the dashboard can hide controls the caller cannot use without
duplicating the role matrix client-side. Owns no table of its own; reads
`users` through `AuthService`.
