# Phase 2A Control Plane

**Status:** Control-plane remediation (docs + machine gates). Does **not** authorize hosted mutation.  
**Runtime edge source boundary:** `63d619fcc3303f05a60888174585408b745f79fc`  
**MIL plane:** `mil.bhfos.com` + `sdzhdupekcnekesbtxsl` + `mil-production`  
**Forbidden CRM plane:** `wwyxohjnyqnegzbxtuxs`

## Hosted current state (read-only verified)

| Item | State |
|---|---|
| Migration A `20260802120000` | **Applied** on `sdzh…` |
| Migration B `20260802130000` | **Absent** |
| Phase 2A edge functions (7) | **Deployed** |
| Unauthenticated denial/redaction probes | **Passed** (prior mission) |
| Privileged positive-path edge verification | **Incomplete** |
| Phase 2A frontend | **Not deployed** (live FE remains `d90eb8f…` / `mil-staging`) |
| Next runtime step | Synthetic privileged verification — **not** Migration B, **not** frontend deploy until authorized |

Later control-plane commits (docs/tooling) do **not** prove runtime deployment.

## Approved command surface

| Action | Approved command | Notes |
|---|---|---|
| Single migration validate/apply-local | `npm run mil:apply-migration -- --project-ref=sdzhdupekcnekesbtxsl --migration-version=… --sql-path=… --checksum=sha256:…` | Default validate-only; `--execute --mode=apply-local` requires `LOCAL_DB_URL` localhost |
| MIL production build | `npm run build:mil-production -- --project-ref=sdzhdupekcnekesbtxsl --rollout-stage=phase-a --expected-sha=<HEAD>` | Hard-fails dirty tree, CRM env, missing sdzh… |
| MIL production package | `npm run package:mil-production -- --project-ref=sdzhdupekcnekesbtxsl --rollout-stage=phase-a --expected-sha=<HEAD> [--allow-test-artifact]` | Never final deployable until certified post-merge |
| Unsafe artifact inventory | `npm run mil:inventory-artifacts` | Read-only; no deletion |

### Prohibited for Phase 2A hosted apply

- Bare `supabase db push` when multiple migrations are pending
- Applying Migration A and B together
- Any MIL migration/apply/deploy targeting `wwyx…`
- Packaging/deploying from dirty trees or pre-boundary `5a5653e` archives

Migration B requires `--authorize-migration=20260802130000` in addition to the normal flags.

## Schema metadata semantics

For `mil-production` builds with `--rollout-stage=phase-a`:

```json
{
  "schemaAppliedThrough": "20260802120000",
  "schemaRequiredThrough": "20260802120000",
  "migrationVersion": "20260802120000",
  "sourceTipMigrationVersion": "20260802130000"
}
```

- `schemaRequiredThrough` = minimum schema the Phase-A frontend needs (Migration A)
- `schemaAppliedThrough` = rollout-stage pin for the artifact class (Phase A ⇒ A). Not a live hosted probe at build time
- `migrationVersion` = alias of `schemaRequiredThrough` when a rollout stage is set
- `sourceTipMigrationVersion` = max migration filename in source (may be B while hosted remains A-only)

## Unsafe artifacts

Local packages named `mil-production-5a5653e0a24c-*.zip` are:

**UNSAFE — DO NOT DEPLOY**

Inventory with `npm run mil:inventory-artifacts`. Deletion requires separate owner authorization.

## Owner-controlled credential cleanup (not Git)

Do **not** commit, move, or delete CRM `.env` files from an agent session without owner authorization.

If a MIL-named worktree’s `command-center/.env` contains `wwyx…`:

1. Freeze MIL `build:mil-production` / `package:mil-production` / Import-Env from that tree
2. Owner quarantines/replaces the CRM clone so MIL trees cannot load `wwyx…` admin keys
3. Keep MIL Vite public keys only in a MIL-scoped file (`sdzh…` only)
4. Keep `HOSTINGER_API_TOKEN` out of MIL app env files
5. Re-run a classification check (keys/refs only — never print values)
6. Rotate CRM tokens that lived in the MIL copy if exposure risk warrants

Machine gate: `assertMilCredentialSourcesSafe` refuses MIL release ops when CRM refs are present in `.env` / `.env.local` / process env.
