# ML-P1 Slice 5 — A3 Production Apply Packet

| Field | Value |
| --- | --- |
| Authority | Founder Delegated-Authority Policy v2026-07-22 + PR #101 merge |
| Merged main tip | `2b37985e25f2afbd6ac209982f724aadd4da404d` |
| Exact code SHA | `f5f0e0969ace339854dda582bd2c9e66a77b3199` |
| Project | `wwyxohjnyqnegzbxtuxs` |
| Live UI | `https://app.bhfos.com` |
| Method | `supabase db query --linked -f` (not blind `db push`) |

## Exact migration set (only these)

| File | SHA-256 |
| --- | --- |
| `20260723120000_ml_p1_s5_invoice_schema.sql` | `1ACE47BFFC160A3E863FA6E645CB499E696A0FBDE3C4F942CFE033392C9F8E59` |
| `20260723121000_ml_p1_s5_invoice_rpcs.sql` | `A142DB9301EA95562AA9B7F7045DD8D27498EA9A9F5753EA498F9F2A3B7AB268` |
| `20260723122000_ml_p1_s5_auto_draft_trigger.sql` | `95C29577922944BCC3B6F7F098CB77ED0B528A9952A70B84A2EC4C8EE8F19C91` |

## Binding constraints

- Additive only — no DROP of columns/tables; no historical financial rewrite (PD-S5-07).
- Never auto-issue / auto-send / auto-charge (PD-S5-01; policy escalation #3).
- Grandfather existing invoices; `s5_created` false on legacy rows.

## Post-apply required

1. Record versions in `supabase_migrations.schema_migrations`
2. I2 object/RPC/trigger presence
3. Edge deploy `work-order-update` (alt-writer deny)
4. Synthetic validation (no real-customer mutations)
5. Hostinger CRM deploy at exact main tip
6. Ledger + evidence closeout
