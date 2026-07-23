# ML-P1 Slice 6 — A3 Production Apply Packet

| Field | Value |
| --- | --- |
| Authority | Orchestrator prompt 2026-07-23 + Delegated Policy v2026-07-23 + PR #104 merge |
| Merged main tip | `206e1411ce89674a9875070586f7e1572d86acc8` |
| Exact code SHA (A2) | `02238f4edd506c0756e74d1dbd0f0640f999b5bb` |
| Project | `wwyxohjnyqnegzbxtuxs` |
| Method | `supabase db query --linked -f` (not blind `db push`) |

## Exact migration set

| File | SHA-256 |
| --- | --- |
| `20260723140000_ml_p1_s6_payment_settings.sql` | `1E268248A1028DBAE04856B96F219ADEC5B43E8D4F1AEB307A68520CD7FFB0D9` |

## Binding constraints

- **No** Stripe secret rotate / webhook endpoint live-reattach in this apply.
- **No** auto-charge enable; flags default OFF; setter denies ON.
- **No** card vault / portal / Terminal.
- Full-Threat charge/refund/dispute E2E requires **`sk_test`** — live key mode is `sk_live` (escalate; do not charge real rails).

## Edge redeploy (post-apply) — EXECUTED

- `public-pay`
- `payment-webhook` / `stripe-webhook`
- `invoice-update-status`

## Hostinger — EXECUTED

- SHA `206e1411ce89674a9875070586f7e1572d86acc8`
- health-probe **HEALTHY**; `migrationVersion=20260723140000`

## Closeout

See `docs/stabilization/releases/ML-P1_SLICE6_A3_POSTAPPLY_CLOSEOUT.md` and `ML-P1_SLICE6_FULL_THREAT_E2E_REPORT.md`.
