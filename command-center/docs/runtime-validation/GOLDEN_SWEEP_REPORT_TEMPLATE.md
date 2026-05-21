# Golden Sweep Report Template

Purpose: turn a founder/operator “golden sweep” into a consistent, actionable report that feeds Issue Intake + Fix Packets.

---

## Run Metadata
- date:
- run_id: `gs_<env>_YYYYMMDD_HHMMSS`
- env: LOCAL / PROD / PROD-READ-ONLY
- tenant:
- build stamp (if visible):
- tester:
- notes (1–2 lines):

## Scenarios Executed
List only what you actually ran (copy/paste + check off):
- [ ] Quote: create → send
- [ ] Quote: approve → job created
- [ ] Schedule: set date/time + tech → confirm schedule
- [ ] Dispatch: schedule now → start job → verify in-progress state
- [ ] Invoice: edit draft → totals correct → save draft (no send) → explicit send
- [ ] Public pay: open pay link → attempt payment (test)

## Top Findings (max 5)
1.
2.
3.
4.
5.

---

## Findings Table

For each finding, fill one block. Keep it short and evidence-first.

### Finding `<F-01>`
- severity: P0 / P1 / P2 / P3
- environment: LOCAL / PROD / MULTI
- area: Quote / Job / Scheduling / Dispatch / Invoice / Public Pay / Auth / Other
- expected:
- actual:
- repro (smallest steps):
  1.
  2.
  3.
- evidence:
  - screenshot(s): `...`
  - network:
    - request: `METHOD URL`
    - status:
    - response (paste key error text only; redact tokens/PII):
  - console (if any; redact):
- suspected cause (optional, 1 sentence):
- next action:
  - [ ] create ticket (ISSUE_INTAKE_SPEC)
  - [ ] create fix packet
  - [ ] blocked (needs access/secret/config)

---

## Artifacts
- artifact folder (local path or Drive link):
- redaction status: YES/NO

## Triage Decision
- P0s to address next:
- P1s to address next:
- deferred:

