# Decision Packet — ML-P1 Money Loop Phase 1 (Planning Ratification)

> **One consolidated founder-facing decision surface.** Agent-prepared. Content
> rules: no credentials, no secrets, no customer data, no pasted logs. Derived from
> `templates/DECISION_PACKET.template.md` and
> `command-center/docs/stabilization/releases/ML-P1_BRIEF.md`.
>
> This packet requests **planning ratification only**. It does **not** authorize
> money-loop product/code implementation, migrations, deployment, production
> mutation, live Stripe/pay, G2.3 reopen, or B3 re-run. Any later implementation
> requires a **separate Founder authorization** naming exact scope, PR, and head SHA.

---

## Release
- **Release ID / governance version:** `ML-P1` / `v2.2`
- **Prior program:** `G2.3` — Stabilization Exit Review complete (minimum safe baseline); **closed, no reopen**
- **Risk tier:** **Tier 3** (money-loop / financial domain) — this packet authorizes **planning docs only**
- **Pinned G2.3 exit baseline SHA:** `6bc8db4f46bb604c0a3e4c9631985e8314616a8d`
- **PR and approved SHA:** `#64` @ head `43c776eaf226fb4c0d9a95da18c6b77a0044f711` → merge `dd7bbe3544f9f8ec016330c5f29b9d8f95f02b40`
- **Planning correction:** Required before implementation — see `ML-P1_PLANNING_CORRECTION_DECISION_PACKET.md`

## Operational problem
G2.3 reached a minimum safe diagnostics baseline, but the Money Loop remains
**without a ratified Phase 1 planning boundary**. Appendix A is still unlocked
(`IN PROGRESS`): evidence formalization, job-state DR ratification, and
`send-estimate` include-or-defer are open. Without a Tier 3 Decision Packet that
separates **planning** from **implementation**, agents risk either stalling or
silently starting money-loop product work under an implied authorization.

## Proposed correction (planning only)
Authorize merge of the ML-P1 **planning document set**:
- `ML-P1_BRIEF.md` — Phase 1 lock focus, canonical loop, outcomes, out of scope
- `ML-P1_DECISION_PACKET.md` — this packet
- Release Baton hygiene: close `RELEASE_BATON.g2-3.yaml`; open
  `RELEASE_BATON.ml-p1.yaml` at `planning_only`

**No product code. No migrations. No deploy. No live pay.**

## What changes
- Repository records a pinned Phase 1 planning / lock boundary on baseline
  `6bc8db4…`.
- Canonical loop is binding for Phase 1:
  **lead → quote → accept → job → invoice → payment → receipt**.
- Phase 1 intended outcomes are listed: Appendix A evidence formalization; DR
  ratify/defer (job-state, send-estimate); quote→pay lock bound; Pillar 1 gaps
  later unless required.
- G2.3 baton closed; ML-P1 baton active at `planning_only`.
- Carry-forward hygiene named: Release Baton refresh; Windows node adapter exit
  anomaly (not core loop).

## What does NOT change
- No money-loop runtime/product behavior.
- No credentials, production access, deploy, migration, or financial action.
- No G2.3 reopen (B4/B5, Hostinger I2, issue #55).
- No B3 re-run requirement.
- No implied authorization for later implementation PRs.

## Evidence (already gathered — do not re-request from the founder)
- **Check results:** docs-only PR — required GitHub checks per repo defaults; no
  application workflow change.
- **Review results:** Architecture Guard **not required** for this planning-docs
  PR. Required when later money-loop behavior changes are proposed.
- **UAT result:** `NOT_APPLICABLE` (no deployed workflow change).
- **Migration status:** `none`.
- **G2.3 exit:** minimum safe baseline accepted at `6bc8db4…` (B3 status/health
  live proof prior; not re-run here).

## Deployment plan
**No deployment.**

## Rollback plan
Clean `git revert` of the planning PR. Repository-only; zero runtime/data/
credential/production impact. Rollback point = pre-merge `main` SHA
`6bc8db4f46bb604c0a3e4c9631985e8314616a8d`.

## Known limitations
- Appendix A remains unlocked until separately authorized formalization work
  completes and DRs are ratified or deferred.
- Local/SOURCE GREEN ≠ production USABLE.
- Duplicate `JobCreated` remains a residual note; in-scope for Phase 1
  implementation only if it blocks quote→pay / A-LOCK evidence.
- Windows node exit anomaly is hygiene, not Phase 1 product scope.
- This packet’s Tier 3 label reflects domain criticality; **authority granted
  here is planning-only**, not implementation.

## Recommendation
**Authorize ML-P1 planning ratification and merge of the exact planning-docs PR
at the named head SHA.** Do **not** authorize implementation, migration, deploy,
or live pay under this packet.

## Exact authorization requested
> **The single yes/no the founder answers:**
> **"Authorize merge of the ML-P1 planning-docs PR at the exact head SHA named
> on the Release Baton / PR (baseline `6bc8db4…`), ratifying Money Loop Phase 1
> planning / lock focus only."**

## Explicit non-authorization
This authorization does **NOT** authorize:

- Money-loop product/code implementation
- Appendix A lock declaration as complete (planning only)
- Migrations / schema / production data changes
- Deploy / Edge Function deploy / Hostinger mutation
- Live Stripe or live payment runs
- G2.3 reopen or B3 re-run
- Pillar 1 gap closure, Pillar 2–4, or TIS work
- Any later implementation PR (requires a **new** Decision Packet + Founder auth
  naming exact PR + head SHA)

_Deployment, migration, financial, destructive, security-control, credential-
provisioning, and customer-communication actions each require their **own**
separate explicit authorization and are not implied by any approval above._
