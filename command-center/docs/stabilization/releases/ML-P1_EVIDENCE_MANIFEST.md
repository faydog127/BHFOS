# ML-P1 Evidence Manifest

Program-level evidence index for ML-P1. Slice-specific manifests remain authoritative for their scope.

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| origin/main (merge tip) | `ced9bfbbe19289a2747c64bb0ce7206872601a06` |
| Price-book PR | https://github.com/faydog127/BHFOS/pull/100 merged at head `a1c822b3a77da99ca8e873e7d6f1144b9e3c34ef` |

## Price-book evidence bundle

| Field | Value |
| --- | --- |
| Bundle id | `ML-P1_PRICEBOOK_IMPORT_2026-07-22` |
| Gate | **A2-MERGED** (prod apply earlier: `CRM_HCP_PRICEBOOK_IMPORT_PASS`) |
| Bundle SHA-256 | `260C5CB28EE1A7F5E4E76A488C38749926CDC8435608F83A1B421808E90A4158` |
| HCP CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| HCP XLSX SHA-256 | `2A5E47BFDABDBF416883F234A4F3E04EB85715E75588570C32860AFC993A46B9` |
| Detail manifest | `ML-P1_PRICEBOOK_EVIDENCE_MANIFEST.md` |
| Peer review | `reviews/ML-P1_PRICEBOOK_PR100_PEER_REVIEW.md` |

### Bundle contents (hashed)

Paths relative to `command-center/`; SHA-256 over path + newline + file bytes, concatenated in this order:

1. `docs/governance/decisions/CRM_HCP_PRICEBOOK_FOUNDER_ANSWERS_2026-07-22.md`
2. `docs/governance/decisions/CRM_HCP_PRICEBOOK_IMPORT_CLOSEOUT.md`
3. `docs/stabilization/releases/ML-P1_PRICEBOOK_EVIDENCE_MANIFEST.md`
4. `docs/stabilization/releases/reviews/ML-P1_PRICEBOOK_PR100_PEER_REVIEW.md`
5. `supabase/migrations/20260722150000_ml_p1_price_book_hcp_fields.sql`
6. `supabase/migrations/20260722151000_ml_p1_price_book_code_unique.sql`
7. `supabase/migrations/20260722152000_ml_p1_price_book_id_updated_at.sql`

## Other ML-P1 evidence (pointers)

| Item | Path |
| --- | --- |
| Slice 4 evidence | `ML-P1_SLICE4_EVIDENCE_MANIFEST.md` |
| Slice 4 state | `ML-P1_SLICE4_STATE_LEDGER.md` |
| Program state | `ML-P1_STATE_LEDGER.md` |
