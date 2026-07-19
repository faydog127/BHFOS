# V1 Cursor Orchestrator Model

This defines how Cursor agents run V1 stabilization without colliding, expanding scope, or touching production unsafely.

---

## Lead orchestrator agent

**Owns:**

- Scope vs V1 freeze rules  
- Backlog dispositions (`V1_STABILIZATION_BACKLOG.md`)  
- File ownership assignment per release  
- Integration of specialist outputs  
- Release verdict draft (merge/deploy readiness)  
- Prevention of overlapping edits  

**Does not:**

- Implement broad changes itself when a specialist is assigned  
- Merge or deploy without human approval  
- Approve migrations unilaterally  

**After every release:** update baseline tip SHA, backlog statuses, scorecard notes, and release plan “completed” markers.

---

## Specialist agents

| Agent | Owns | May edit | Must not |
| --- | --- | --- | --- |
| **1. Stability / data** | Schema contracts, identity, embeds, money status reads | Services, SQL **only if approved**, ownership docs | UI redesign, deploy |
| **2. Field UX** | Tech PWA inspection/queue/schedule mobile | `src/pages/tech/**`, `src/components/tech/**`, field helpers | Office CRM rewrites, migrations |
| **3. Office UX** | CRM intake, quotes, jobs, invoices UI | `src/pages/crm/**`, related components | Tech PWA, edge deploy |
| **4. Test / review** | Focused tests, review gate, acceptance checklists | `tests/smoke/**`, checklists under `docs/stabilization/` | Product behavior without paired implementer |
| **5. Release** | Clean worktree, build, Hostinger/function deploy reports | Deploy tools (R8+), release notes | Feature code in same PR as deploy tooling unless R8 |

---

## Parallelism rules

**Allowed in parallel:**

- Read-only exploration  
- Test-only work on files not being edited by implementers  
- Documentation updates that do not change code ownership  

**Only one implementation agent may edit** a given file set at a time.

**Serialize when:**

- Touching shared helpers (`inspectionFieldAddress`, `paymentService`, quote/job triggers)  
- Any migration discussion  
- Release packaging  

---

## Worktree rules

| Rule | Detail |
| --- | --- |
| Never use | `F:\Dev\BHFOS` (dirty original) |
| Always start from | `git fetch origin main` + verified SHA |
| Pattern | `git worktree add --detach F:\Dev\BHFOS-stabilize-rN origin/main` then branch |
| One theme per worktree | Named for the release |
| No deploy from | Development/feature worktrees with local `.env.local` pointing at localhost |

---

## Branch rules

- Branch from verified `origin/main` only  
- Name: `stabilize/rN-<short-theme>` or `hotfix/<defect>` for outages  
- One operational problem per PR  
- No unrelated cleanup  
- No V2 features  

---

## Review gates

Before asking human to merge:

1. Inspected relevant code (cited)  
2. Focused tests added/updated for behavior change  
3. `lint` + `build` + `review:gate` (local)  
4. Required GitHub checks green  
5. Diff limited to owned files  
6. Migration absent **or** explicitly approved in PR body  

---

## Merge authority

- **Human only by default** (exact PR + approved head SHA)
- **Exception (after activation on main):** `LOW-RISK_CONTROL_PLANE_CORRECTION`
  may omit Founder merge authorization only when every eligibility gate in
  `docs/governance/LOW_RISK_CONTROL_PLANE_CORRECTION.md` is true; Orchestrator
  records the basis; Release Agent merges mechanically with exact-head guard
- Orchestrator prepares summary: intent, risk, test proof, rollback  
- Squash-merge preferred for stabilize releases  

## Founder Focus handoffs

- The Orchestrator owns routine inter-agent handoffs (Builder → Architecture
  Guard → Release Agent → Orchestrator; routine CI status)
- Do not ask the Founder to copy-paste routine technical reports between chats
- If Cursor cannot automate a handoff, produce **one** compact relay block and
  state why manual relay is unavoidable; increment `founder_manual_relays_requested`
- Before any Founder terminal/OAuth/credential/dashboard/launcher action, run
  `FOUNDER_RUN_READINESS` (`docs/governance/FOUNDER_RUN_READINESS.md`)
- When a Founder action fails, classify and route the failure; do not ask the
  Founder to diagnose it

---

## Deployment authority

- **Human only**  
- Release agent prepares clean worktree at merge SHA  
- Frontend → Hostinger only when release says so  
- Edge functions only when diff proves change  
- Migrations only with explicit written approval  
- Synthetic production smoke required  
- No customer contact / no live charges in smoke  

---

## Documentation updates required after each release

| Doc | Update |
| --- | --- |
| `V1_SYSTEM_BASELINE.md` | New tip SHA, assets, function versions if changed |
| `V1_STABILIZATION_BACKLOG.md` | Disposition → done / residual |
| `V1_WORKFLOW_SCORECARD.md` | Rescore affected workflows |
| `V1_RELEASE_PLAN.md` | Mark release complete + date |
| New | `docs/stabilization/releases/R<N>_REPORT.md` (short deploy + smoke record) |

---

## Non-negotiable rules (copy into every stabilize prompt)

1. Never use the original dirty worktree  
2. Always branch from verified `origin/main`  
3. One operational problem per PR  
4. Inspect before editing  
5. Reuse existing services before creating new ones  
6. No migration without explicit approval  
7. No production access during implementation  
8. No deployment from a development worktree  
9. No unrelated cleanup  
10. No V2 work inside V1  
11. Human approval before merge and deployment  
12. Production acceptance before release closure  

---

## V1 feature freeze reminder

**Allowed:** defects, security, tenant isolation, data integrity, migration-history fixes, reliability, mobile usability corrections, workflow simplification, report correctness, deployment-process corrections.

**Forbidden:** major new modules, broad rewrites, speculative automation, major CRM expansion, V2 concepts, new multi-tenancy architecture, major analytics, cosmetic redesign without operational value.
