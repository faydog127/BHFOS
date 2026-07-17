# Decision Packet (template) — BHFOS Operating Model v2.2

> **One consolidated founder-facing decision surface per routine release.**
> The founder should normally make **one** decision from this packet. This packet
> is **agent-prepared**; the founder does not assemble it. It must **not** ask the
> founder to repeat data already in the brief, Release Baton, GitHub, CI, the
> Release Ledger, or verification evidence, and must **not** route commands, log
> review, credential handling, or deployment mechanics to the founder.
>
> Content rules: no credentials, no secrets, no customer data, no pasted logs.

---

## Release
- **Release ID / governance version:** `<release_id>` / `v2.2`
- **Risk tier:** `<Tier 1 | Tier 2 | Tier 3>`
- **PR and approved SHA:** `#<pr_number>` @ `<approved_head_sha>`

## Operational problem
`<the one concrete operational problem this release addresses>`

## Proposed correction
`<the smallest safe change that resolves the problem>`

## What changes
`<user-visible / behavioral change, briefly>`

## What does NOT change
`<explicit exclusions; confirm no unrelated scope>`

## Evidence (already gathered — do not re-request from the founder)
- **Check results:** `<required GitHub checks — green/failed; CI authoritative>`
- **Review results:** `<Architecture Guard verdict, or "not required for tier">`
- **UAT result:** `<PASS | FAIL | PARTIAL | BLOCKED | UNVERIFIED | NOT_APPLICABLE | OWNER_CONFIRMATION_REQUIRED>`
- **Migration status:** `<none | not_required | authorized | applied | verified>`

## Deployment plan
`<who deploys (Production Operator under authorization), target environment, and how deployed SHA/identity is confirmed — or "no deployment required">`

## Rollback plan
`<predefined rollback point and who executes it>`

## Known limitations
`<anything the founder should weigh, briefly>`

## Recommendation
`<the coordinating owner's single recommendation>`

## Exact authorization requested
> **The single yes/no the founder answers:**
> `<e.g. "Authorize Release Agent to merge PR #<n> at head SHA <sha>." or
>  "Authorize Production Operator to deploy approved SHA <sha> to production.">`

_Separate actions (migration, deployment, financial, destructive,
security-control, customer-communication) each require their **own** explicit
authorization and are not implied by any single approval above._
