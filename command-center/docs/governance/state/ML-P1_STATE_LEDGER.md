# ML-P1 State Ledger (governance/state)

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| Repo | https://github.com/faydog127/BHFOS |
| Exact `origin/main` / prod | `c469f7c8174642f40ca60756c124dec63a80bb10` (UX Hostinger) |
| Authority | Precedence + Delegated-Authority auto-continue |

## Slice posture

| Slice | Status |
| --- | --- |
| S1–S5 | **CLOSED** |
| **S6** | **CLOSED** — `SLICE6_PRODUCTION_VALIDATION_PASS` |
| **S7** | **Deferred** — do not start |
| **S8** | **SLICE8_PRODUCTION_VALIDATION_PASS** (remediation) |
| **UX-REFACTOR** | **PRODUCTION DEPLOY PASS** — Hostinger HEALTHY @ `c469f7c` · rollback `fcc1fcc` |
| Photo Bundles | **Deferred** |

## UX-REFACTOR entry

| Field | Value |
| --- | --- |
| Planning base | `a12b0f4502fe668a900381753128e9e4724cd844` |
| A2 base | `67423d2468c647cac17c8afc766c1bc86ff42e2d` |
| Scope | Global shell, nav, design tokens, component consolidation — top 5 screens |
| Top 5 | Hub · Work Orders · Quotes · Inspections · Settings |
| Brief | `docs/stabilization/releases/UX_REFACTOR_BRIEF.md` |
| Policy | Peer review ×3 → CI → auto-continue |
| Migrations | **Forbidden** |

## Halt defaults

Auto-send · auto-charge · vault/portal/Terminal · TIS merge · Photo Bundles · S7 · UX-REFACTOR migrations (none allowed).
