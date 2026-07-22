# Decision Packet — ML-P1 Slice 3 `events.actor_id` UUID Remediation

> Bounded forward remediation under existing Slice 3 authorization.  
> Does **not** authorize Slice 4, Stripe, invoices, follow-up, TIS, or G2.3.

---

## Disposition

# **SLICE3_REMEDIATION_IN_PROGRESS → revalidate 3/4/10**

---

## Root cause (primary)

`ml_p1_s2_quote_lifecycle` (from `20260721200000_ml_p1_s3_canonical_job_writer`) inserts
`v_uid::text` into `public.events.actor_id`, which is typed **uuid**. Office
`issue` / `approve` therefore abort before commit; public approve already used
`NULL` and was unaffected.

Live OpenAPI confirms `events.actor_id` format=`uuid`.

## Root cause (follow-on, check 4)

After actor_id fix, first office approve succeeds, but idempotent
`ensure_job` / replay hits `coalesce(quotes.quote_number int, jobs.quote_number text)`
inside `ml_p1_s3_ensure_job_for_accepted_quote` → `COALESCE types integer and text`.

---

## Exact changes

| Surface | Change |
| --- | --- |
| DB object | `public.ml_p1_s2_quote_lifecycle(...)` |
| Migration | `20260721210000_ml_p1_s3_lifecycle_actor_id_uuid.sql` · SHA-256 LF `179B3CFD…418567` · **applied** |
| DB object | `public.ml_p1_s3_ensure_job_for_accepted_quote(...)` |
| Migration | `20260721211000_ml_p1_s3_writer_quote_number_text.sql` · SHA-256 LF `24ECC0D4…9F6A7` |
| Tests | `ml-p1-s3-lifecycle-actor-id.test.mjs` (8) · `ml-p1-s3-writer-quote-number.test.mjs` (3) |
| Edge / Hostinger | **No change required** |

### Reviews (actor_id surface)

Product / Data / Security / Financial / Architecture / Adversarial → **REMEDIATION_REVIEW_PASS**

### Actor semantics preserved

| Path | `events.actor_id` |
| --- | --- |
| Authenticated office/admin | `auth.uid()` uuid (`v_uid`) |
| Public token approve | unchanged — `NULL` (nullable/system convention) |
| Writer ensure events | unchanged — `NULL` |
| Payload / `approved_by_actor_id` | remain text serialization of uuid (not column cast of free-form input) |

No free-form text → uuid cast. Audit insert not suppressed. Approve + canonical
writer remain same-transaction.

---

## Migration identity

| Field | Value |
| --- | --- |
| Filename | `20260721210000_ml_p1_s3_lifecycle_actor_id_uuid.sql` |
| SHA-256 (LF) | `179B3CFD29A9D55C3B68F4C19F7C411821E3536FF402A3600B84BB614B418567` |
| Base tip | `5cd7360aceb5492985cea6f3ff56253e5165bbea` |

---

## Tests

`node --test tests/unit/ml-p1-s3-lifecycle-actor-id.test.mjs` → **8/8 PASS**

Coverage: office UUID actor; break-glass reason + writer + audit order; no
free-form actor cast; audit semantics; idempotent ensure; no partial suppress;
public NULL convention; deny/paid/writer untouched.

---

## Apply + deploy plan

1. Merge remediation PR to `main`.
2. Apply migration to `wwyxohjnyqnegzbxtuxs` (SQL Editor or approved DB path).
3. **No Edge redeploy** (functions unchanged).
4. **No Hostinger redeploy** (frontend unchanged).
5. Revalidate production checks **3, 4, 10** + audit `actor_id` uuid.
6. Cleanup synthetic test data only.

---

## Rollback

Re-replace `ml_p1_s2_quote_lifecycle` from
`20260721200000_ml_p1_s3_canonical_job_writer.sql` (restores broken text cast —
only if remediation itself regresses). Prefer forward fix. Do not reverse S3
writer migration.
