# Reports (Handoff Notes)

Purpose: when you say “the report in X folder”, this tells you **which exact file to send** and **how to regenerate it** without guessing.

---

## 730 Scott — Before Condition Report (Estimate #20267601)

**Customer-send PDF (primary):**
- `tmp/730 Scott/estimate-20267601-before-report/estimate-20267601-before-report.pdf`

**Preview image (quick check):**
- `tmp/730 Scott/estimate-20267601-before-report/preview.png`

**Source config (edit these fields if needed):**
- `tmp/730 Scott/estimate-20267601-before-report/config.json`

**Evidence/verification output (the “why” behind the status):**
- `tmp/730 Scott/estimate-20267601-before-report/evaluation.json`

### Regenerate the report (HTML + PDF)

From repo root `c:\BHFOS\command-center`:

`node tools/generate-before-report.mjs --input "tmp/730 Scott" --output "tmp/730 Scott/estimate-20267601-before-report" --estimate "20267601" --evaluation "tmp/730 Scott/estimate-20267601-before-report/evaluation.json"`

Notes:
- If the PDF doesn’t regenerate, the script will still emit the HTML and report a `pdf_error` (usually Playwright availability).
- The output HTML is kept portable by copying images into `.../assets/`.

