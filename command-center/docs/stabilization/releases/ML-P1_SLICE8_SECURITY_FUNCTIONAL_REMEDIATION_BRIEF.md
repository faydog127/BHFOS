# ML-P1 Slice 8 — Security & Functional Remediation Brief

| Field | Value |
| --- | --- |
| Release | ML-P1 S8 remediation (inspection workflow only) |
| Base `origin/main` | `f39045ca125f7fbe94b9b2f9096b6f9cc20b70c4` |
| Branch | `fix/ml-p1-s8-security-functional-remediation` |
| Worktree | `F:\Dev\BHFOS-ml-p1-s8-remediation` |
| Authority | Founder halt — no merge / prod migrate / deploy without explicit Erron auth |
| Out of scope | Photo Bundles · S7 warranty · Stripe/money · TIS · unrelated cleanup |

## Why this release exists

Prior A3 closeout (PR #110) proved **deployment and reachability only**. Post-deployment quality review withdrew functional and security acceptance. This brief bounds the remediation to restore server-enforced integrity and field-usable completion semantics.

## In-scope outcomes

1. Tenant membership + role checks inside every privileged S8 `SECURITY DEFINER` RPC.
2. Harden DEFINER grants (`search_path`, revoke PUBLIC/anon, qualify objects).
3. Checklist completion requires answered mandatory items (not photo existence alone).
4. Item-specific `photo_required` enforced server-side against complete, non-voided evidence.
5. Evidence gates count only `upload_state = 'complete'` and non-voided rows.
6. Finalization runs only after gates pass (atomic with `inspection_finalize_phase5`).
7. Finalization remains revision-safe / idempotent under retry and concurrency.
8. Offline queue retains queued/failed blobs until sync success or explicit authorized discard.
9. Executable tests prove allow and deny paths (unit, RPC, two-tenant, roles, workflow, offline).

## Explicit non-goals

- Photo Bundles product work  
- Rewriting A3 history as broader acceptance than deploy/reachability  
- Frontend-only “security by hiding buttons”

## Exit criteria (Founder authorization required to execute)

- Remediation PR open with CI green  
- Independent reviews (not Builder self-cert) anchored to exact head SHA  
- Control report presented  
- **Then** Erron authorizes merge → migrate → Hostinger (if needed) → validation
