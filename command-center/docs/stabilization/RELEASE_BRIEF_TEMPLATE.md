# Release Brief — R&lt;N&gt; &lt;short theme&gt;

> Orchestrator output. One operational problem. Owner approves this brief before
> any implementation starts. Copy this file to
> `docs/stabilization/releases/R<N>_BRIEF.md` and fill it in.

## 1. Objective (one problem)
State the single operational problem in one or two sentences. No bundled work.

## 2. Why now / owner priority
Who is blocked, and what breaks without it. (Owner-observed > inferred.)

## 3. In scope
- Exact behavior to change:
- Surfaces affected (role + route + viewport): e.g. Office `/tvg/crm/inspections/new`, desktop

## 4. Out of scope (explicit)
List related things deliberately NOT touched this release (prevents scope creep).

## 5. Owning module + files
- Business owner (from `V1_MODULE_OWNERSHIP.md`):
- Files the Implementation agent may edit:
- Shared helpers touched (must serialize / extra review):

## 6. Expected visible behavior + acceptance evidence (owner-verifiable)
Written as USABLE-tier checks: exact role + exact route + exact browser/device +
expected visible result. Name the evidence to capture (screenshot / console / network).
- [ ] In &lt;role&gt; on &lt;route&gt; in &lt;browser/device&gt;, &lt;action&gt; produces &lt;visible result&gt; — evidence: &lt;screenshot ref&gt;
- [ ] No regression to &lt;named working flow&gt;

## 6a. Owner checkpoint
State the exact point where the owner must personally verify and confirm before the
release can advance (e.g. "owner confirms last customer selectable in Chrome").

## 6b. Risks
- What could break (blast radius):
- Trigger-domain exposure:
- Shared-helper / cross-surface risk:

## 7. Trigger-domain check
Does this touch tenant_isolation / money_state / acceptance_commit / state_machine /
completion_gate? **Yes/No.** If yes: review gate + owner approval required; name the domain tag(s).

## 8. Migration?
**No** by default. If yes: justify, and note it needs explicit written owner approval.

## 9. Test plan
- Focused test(s) to add/update:
- If a behavior change cannot be tested, document why here.

## 10. Rollback / stop conditions
- How to revert safely (revert PR / previous asset / no data change):
- Stop conditions (halt and return to Orchestrator/owner): root cause differs from
  this brief, scope would grow, a migration becomes necessary, or a trigger domain
  is touched unexpectedly.

## 11. Definition of done
- [ ] Implementation PR opened (scope-limited, tests included)
- [ ] Architecture/Contract Guard review passed
- [ ] CI green (`lint`, `build`, `review:gate`, `ledger_lock`)
- [ ] Independent UAT: owner-confirmed USABLE evidence captured
- [ ] Owner accepted material workflow
- [ ] Release merged + deployed by Release role (human-approved)
- [ ] Production re-verified by Independent UAT
- [ ] Backlog/baseline/scorecard updated
