## Release process (BHF priority)

1) Branching
- `main` protected; no direct pushes.
- Work on feature branches; merge via PR only after checks pass.
- Create `release/*` branches for deploy candidates; tag each release (`vX.Y.Z`).

2) Change logging
- On each merge to `release` or `main`, append to `docs/CHANGELOG.md`:
  - Summary of change
  - Files/touch points
  - Feature flags impacted
  - Migration notes (if any)
  - Tag/version
- For each release, create `docs/RELEASE_NOTES_<tag>.md` if needed (detail/links/screenshots).

3) Visual checkpoints
- For each tagged release, capture key UI screenshots or short Loom/GIF and link them in `CHANGELOG.md` or the release notes.

4) Migrations
- Use reversible migrations. Log each in `docs/migrations/` with:
  - ID/date/owner
  - Up/down steps
  - Risk notes and rollback steps
  - DB snapshot/backup reference if taken
- Run risky migrations separately from app deploy; take snapshots before if needed.

5) Feature flags
- Define defaults in BHF (highest priority). Tenants can override only where allowed.
- Document flags and per-tenant defaults in `docs/feature-flags.md`.
- Hide and 403 routes when flags are off.

6) Rollback
- Code: redeploy last good tag from `release`/`main`.
- DB: run “down” migration or restore snapshot noted in `docs/migrations/`.
- Keep recent build artifacts or a “redeploy last-good” script to speed rollback.

7) Tests/checks
- On PR: lint/tests/type-check; optional short smoke.
- On `release/*`: add a smoke/E2E on core flows; record pass/fail in `CHANGELOG.md`.

8) Routing audit
- Maintain `docs/ROUTING_AUDIT.md` with expected routes and status; update after routing changes.

9) Deployment
- Follow `docs/DEPLOYMENT_CHECKLIST.md` per release/tag.
