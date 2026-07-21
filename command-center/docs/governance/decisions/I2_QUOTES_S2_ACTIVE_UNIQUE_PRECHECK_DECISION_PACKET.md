# Decision Packet — I2 Quotes S2 Active-Unique Aggregate Precheck

> Requests exact-head Founder **merge** after Security · Data · Architecture ·
> Adversarial review. Does **not** apply S2 migrations, deploy, or begin Slice 3.

| Field | Value |
| --- | --- |
| Release ID | `I2-QUOTES-S2-ACTIVE-UNIQUE-PRECHECK` |
| Base | `b2edaca6cc22b0299888b38cffac7835fa97f413` |
| Branch | `ml/i2-quotes-active-unique-precheck` |
| PR | [#80](https://github.com/faydog127/BHFOS/pull/80) |
| Frozen head | `06fc3aecefabc1a70c89c7b7919630cb31106ec2` |
| Scope | One read-only aggregate catalog op for S2 uniqueness precheck |

## Correction

Add `catalog_quotes_s2_active_unique_conflict_counts`: hardcoded `public.quotes`
SELECT returning only `conflict_group_count` and `conflicting_row_count` under
the exact proposed S2 active unique predicate (includes `issued`). Response
sanitizer strips any other keys. No new OAuth scopes.

## Non-goals

S2 A3 apply · deploy · Slice 3 · Stripe · invoice · TIS · G2.3 · row/token dumps

## Tests

`npm run test:supabase-diagnostics-adapter` — PASS (self-test + catalog.self-test including positive/negative aggregate cases).

## Founder merge line (after reviews)

> Authorize merge of PR #80 at `06fc3aecefabc1a70c89c7b7919630cb31106ec2` (source only). Does not authorize deploy, A3 prod migration apply, Slice 3, Stripe, follow-up, job, or invoice.
