# Decision Packet — ML-P1 Slice 8 (PD-S8-01…07) — RATIFIED

| Field | Value |
| --- | --- |
| Disposition | **RATIFIED Category-C** · A2 coding authorized |
| Coding base SHA | `28e8290a69773cda146cac083971700778db1db7` |
| Branch | `ml/p1-s8-inspection-workflow` |
| Worktree | `F:\Dev\BHFOS-ml-p1-s8` |
| Parameters | `CACHE_MB=250` · `RETENTION_MONTHS=24` |

## Ratified answers

| PD | Choice | Meaning |
| --- | --- | --- |
| 01 | **A** | Wave delivery — photos first, report after |
| 02 | **A** | Max offline photo cache **250 MB** |
| 03 | **A** | Checklist templates per work-type |
| 04 | **A** | Retain raw photos + generated PDF reports **24 months** |
| 05 | **A** | Structured on/off/flag fields per checklist item |
| 06 | **A** | Read-only analytics only (no predictive models) — *thin / incremental in A2* |
| 07 | **A** | Incremental nav/UX only (no mobile app) |

## A2 scope binding (Founder “After this prompt”)

**In this coding branch**

- Inspection checklist templates + responses  
- Offline photo queue budget 250 MB  
- Photos-before-report gate  
- Structured safety/quality/make_safe flags + office badges  
- 24-month `retain_until` on inspection photos  
- Incremental nav label polish (Reporting → Analytics alias)

**Explicitly out of this A2**

- Customer **photo-bundle** product (select shots → proposal/invoice PDF album) — **future slice**  
- Stripe / auto-charge / S7 warranty automation  
- Full analytics rewrite / predictive models  
- Native mobile app  

## Coding auth

```
CATEGORY-C: AUTHORIZE A2 CODING
branch: ml/p1-s8-inspection-workflow
worktree: F:\Dev\BHFOS-ml-p1-s8
base-sha: 28e8290a69773cda146cac083971700778db1db7
```
