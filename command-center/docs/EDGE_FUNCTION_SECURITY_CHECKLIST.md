# Edge Function Security Checklist

Use this checklist to review every tenant-scoped Edge Function.

## Gateway and Auth
- `config.toml` has `verify_jwt = true`.
- Function does not call `auth.getUser()` for validation.
- JWT claims are decoded locally and treated as the source of truth.
- Authorization header is required (`Bearer <token>`).

## Tenant Isolation
- Tenant ID comes from JWT claims, not the request body.
- If body includes `tenant_id`, it must match the JWT tenant.
- All DB queries use the JWT tenant for filtering.

## DB Access and RLS
- Service role client is used only for DB access.
- Queries replicate required RLS rules in code.
- Never trust client-provided IDs without tenant scoping.

## CORS and Origin
- Origin allowlist includes all expected dev/prod origins.
- `Access-Control-Allow-Origin` is set only for allowed origins.
- Preflight (`OPTIONS`) is handled consistently.

## Error Handling and Observability
- Unauthorized responses are explicit and consistent.
- Logs do not include raw tokens or secrets.
- Errors do not leak internal stack traces to clients.

## Input Validation
- Validate required fields in the request body.
- Reject unexpected or invalid values early.
- Enforce method constraints (POST-only where required).

## Deployment Hygiene
- Re-deploy after any change to `_shared` or `_lib` helpers.
- Confirm logs for the updated deployment before testing.
- Keep config changes (`verify_jwt`) in source control.
