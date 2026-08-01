
# BHFOS V2 — Definition of Ready and Done

| Field | Value |
| --- | --- |
| Status | Active |
| Version | 0.1 |
| Owner | Founder |
| Last reviewed | 2026-08-01 |
| Implementation authority | Active governance authority; no implementation authority |

## Work classes

| Work class | Typical completion path |
| --- | --- |
| Documentation | Draft → Review → Approved → Done |
| Research | Discovery → Review → Finding recorded → Done |
| Decision | Proposed → Founder review → Active or Rejected |
| Prototype | Ready → In Progress → Review → Learning validated → Done |
| Application code | Ready → In Progress → Review → Testing → Accepted in Staging |
| Production change | Accepted in Staging → Ready to Release → Released → Production Verified → Done |

Not every work class uses every project status.

## Implementation slice

An implementation slice is the smallest independently reviewable and testable change that produces one observable outcome.

## Definition of Ready

An implementation slice is Ready only when:

- [ ] Requirement ID is approved or explicitly authorized for discovery.
- [ ] Active Release ID is identified.
- [ ] Applicable Decision IDs are identified; missing or unclear governing decisions move the item to `Needs Decision`.
- [ ] Work item or issue ID is recorded.
- [ ] Branch and worktree are identified.
- [ ] Observable outcome and acceptance criteria are stated.
- [ ] Validation method and evidence location are stated.
- [ ] Data touched by the requirement is identified.
- [ ] Data classification is recorded.
- [ ] Access, retention, logging, and deletion expectations are identified where applicable.
- [ ] Restricted data is excluded from source control, logs, fixtures, screenshots, and AI prompts unless explicitly authorized and protected.
- [ ] Development, testing, staging, and production behavior is identified.
- [ ] Test or synthetic activity cannot write to production customer or financial records.
- [ ] Environment credentials and deployment targets are separated.
- [ ] Rollback or recovery expectations are understood where state can change.

## Required implementation traceability

Every implementation slice must trace through:

`Requirement ID` → `Active Release ID` → `Work item or issue` → `Branch and worktree` → `Pull request` → `Tests` → `Validation evidence` → `Deployed SHA, when production is affected`

## Definition of Done

An implementation slice is Done only when its acceptance criteria are met, review is complete, required tests pass, validation evidence is recorded, documentation is updated, and any release or production verification is complete. A draft document is not Done merely because it exists.

## Completion classes

| Work class | Completion requirement |
| --- | --- |
| Documentation | Reviewed, approved, and committed |
| Research | Question answered, evidence recorded, and decision created if needed |
| Prototype | Learning objective completed; prototype is explicitly not production authority |
| Application code | Tests, review, and staging acceptance completed |
| Production change | Deployment and production verification completed |

`Done` means all completion requirements applicable to that work class are satisfied. No item may be marked `Done` directly from `In Progress`.

## Source-control and release evidence

No implementation slice may reach `In Progress` without a Requirement ID and active Release ID. Nothing may reach `Released` without a pull request, exact SHA, and validation evidence. Unrelated changes, generated files, secrets, and customer data must remain out of the commit.

# Emergency production exception

Only the founder may declare an emergency production exception.

An AI agent, reviewer, contractor, or automated process may recommend an emergency declaration but may not invoke one.

An exception is limited to:

- active security exposure;
- financial-integrity failure;
- material data-loss risk;
- production availability failure;
- an operational failure preventing essential business activity.

The repair must:

- be recorded as an incident;
- contain the smallest safe change;
- identify rollback steps;
- avoid unrelated improvements;
- receive post-implementation review;
- complete any bypassed documentation and testing immediately afterward.

This exception does not authorize normal product development.
