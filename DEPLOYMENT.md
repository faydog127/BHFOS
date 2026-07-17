# Deployment Guide

> **Scope of this document.** This describes the *repository tooling and the
> verified current deployment model* for the BHFOS production frontend. The
> presence of this tooling in the repository does **not** by itself authorize a
> production deployment. Actual deployment authority is granted separately under
> the G2.3 production-readiness program (Production Operator, phase G2.3C) via an
> exact, written authorization naming the specific PR and commit SHA. Nothing in
> this document should be read as a standing permission to deploy.
>
> **No credentials, tokens, secret values, or environment-file contents appear
> in this document.**

---

## 1. Production model (verified)

| Item | Value |
| --- | --- |
| Production domain | `app.bhfos.com` (CRM at `/`, TIS at `/tis/`) |
| Host | Hostinger static hosting (files served from `public_html/`) |
| Upload mechanism | Hostinger Files API + TUS resumable upload |
| CI/CD deploy | **None.** CI builds only; it does **not** deploy. |
| Previous hosts | Vercel is disconnected; Netlify is not used. |

The frontend is a static build uploaded to Hostinger. There is no
platform-managed Git deployment; deployment is an explicit, operator-run action
against an already-approved build.

---

## 2. Build

| Command | Purpose | Artifact directory |
| --- | --- | --- |
| `npm run build:local` | Vite-only build used by CI (no production `.env` required). Also emits `dist/build-info.json`. | `command-center/dist` |
| `npm run build` | Production build via `tools/build-production.mjs`. Requires a local production `.env`, enforces the `VITE_` allowlist, runs the `dist` secret scan, and emits `dist/build-info.json`. | `command-center/dist` |

TIS builds to `TIS/dist` (built from the `TIS` project).

### Build identity

Every build emits `dist/build-info.json` (see
`command-center/tools/generate-build-info.mjs`). It is a deterministic,
**non-secret** record containing the commit SHA, merge SHA (where available),
build timestamp, release identifier, environment, migration version, and
frontend asset version. Undeterminable fields are emitted as the explicit string
`unknown`; a deployed SHA is never fabricated.

Verify a build-info file with:

```bash
node tools/verify-build-info.mjs dist/build-info.json
# release-grade build (requires a real commit SHA):
node tools/verify-build-info.mjs dist/build-info.json --require-release
```

The in-app diagnostics surface reads its identity from
`command-center/src/config/version.js`, which now exposes the injected build
stamp instead of a frozen constant.

---

## 3. Prerequisites for a deployment (when separately authorized)

- Node `20.19.1` (matches CI).
- A clean, freshly built `dist` for each app being deployed.
- `HOSTINGER_API_TOKEN` present **only** in the operator's local environment or
  secret store — never in the repository, never printed, never logged. (See the
  Secret Inventory: `command-center/docs/governance/SECRET_INVENTORY.md`.)
- The exact approved commit SHA for the release.

---

## 4. Dry-run procedure (always first, no network mutation)

The deploy CLI (`command-center/tools/deploy-hostinger-static.mjs`) **defaults to
non-mutating behaviour**. Always dry-run before any real deploy:

```bash
node tools/deploy-hostinger-static.mjs --dry-run --environment=production --app=crm
```

The dry run performs **zero network operations**. It validates the source
directory, confirms `build-info.json` is present, prints the target identity and
the intended SHA + release identity, and runs a local secret scan over the files
that would be uploaded. It never contacts Hostinger.

---

## 5. Exact-SHA verification

Before and after any deploy, confirm identity:

1. Read `dist/build-info.json` and confirm its `commitSha` equals the approved
   SHA.
2. After deploy, run the health probe against the live site and confirm the
   deployed `build-info.json` reports the same SHA:

```bash
node tools/health-probe.mjs --url=https://app.bhfos.com
```

If the intended SHA is missing or conflicts with the build output, the deploy
tooling stops before any network call.

---

## 6. Mutating deploy (separately authorized only)

A mutating upload is intentionally hard to trigger. It requires **all** of:

- `--execute` (explicit production action flag),
- `--environment=production` (explicit target environment),
- `--authorization=<reference>` (explicit written-authorization reference),
- `--sha=<40-hex>` (explicit intended commit SHA), and
- `--i-understand-production` (explicit acknowledgement).

The target identity and intended SHA are printed **before** any mutation is
attempted. Ordinary validation commands (lint, build, test, dry-run) can never
trigger an upload.

> **G2.3A status:** the mutating upload path is **not enabled** in this release.
> The tooling is committed for review, not for execution. Enabling and exercising
> it is a separately authorized action under G2.3C.

---

## 7. Rollback (current limitations)

- **Frontend:** rollback means redeploying a previously built, locally retained
  asset set for the prior approved SHA. This is a forward redeploy of known-good
  assets.
- **No server-side rollback capability is claimed.** Hostinger static hosting is
  not known to preserve a restorable previous release server-side; no such
  capability has been independently verified. Do not rely on a server-side
  "undo".
- **Database:** there is **no database rollback**. Schema changes are
  forward-only and require a backup plus a forward-repair plan. Migrations are
  out of scope for deployment and require separate authorization.

---

## 8. Credential handling rules

- Deployment tokens live in the operator's local environment or a secret store
  only.
- Tokens are **never** committed to the repository, pasted into documents or
  chats, printed to logs, or embedded in a build artifact.
- The deploy tooling loads the token from the environment only and masks it in
  any output.
- Deployment archives are built from `dist` and are scanned for secrets; an
  archive must never contain secret material.

---

## 9. Prohibited production actions

Each of the following requires its **own** separate, explicit authorization and
is **not** implied by the ability to deploy the frontend:

- running database migrations,
- financial actions (charges, refunds, invoices),
- customer communications,
- destructive operations (deletions, data correction on real records),
- any action outside frontend deploy / frontend rollback.

---

## 10. Related repository tooling

| Tool | Purpose |
| --- | --- |
| `tools/generate-build-info.mjs` | Emit `dist/build-info.json`. |
| `tools/verify-build-info.mjs` | Validate build identity (read-only). |
| `tools/deploy-hostinger-static.mjs` | Deploy CLI (default non-mutating; dry-run first). |
| `tools/deploy-lib.mjs` | Deploy library (mutation gated; committed, not executed). |
| `tools/health-probe.mjs` | Non-destructive health probe (local dir or live URL). |
| `tools/verify-migration-state.mjs` | Read-only migration-state verifier. |
| `tools/verify-branch-protection.mjs` | Read-only branch-protection verifier. |

See `command-center/docs/governance/` for the Secret Inventory, Synthetic-Data
Registry, Release Baton, and Release Ledger.
