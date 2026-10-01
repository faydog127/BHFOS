# TVG Financial Planning App — Grok/Cursor Build Handoff

**Status:** Founder-approved product/build direction  
**Implementation:** Authorized for an isolated implementation branch  
**Production deploy:** NOT authorized  
**Production migration execution:** NOT authorized  
**Repository:** `faydog127/BHFOS`  
**Existing frontend:** `command-center`  
**Target route:** `/:tenantId/finance/*`  
**TVG target:** `https://app.bhfos.com/tvg/finance`

## Mission for Grok

Grok is the BHFOS Persistent Build Coordinator/courier for this mission. Hand this exact bounded mission to Cursor. Cursor builds and tests; Grok coordinates, collects evidence, detects stalls, and returns material ambiguities to Command Center.

Do not duplicate Cursor's implementation work. Do not perform local-worktree actions yourself.

## Product objective

Convert the TVG forward-cost model into a polished internal financial-planning application that can be maintained by a finance partner without requiring spreadsheet-model expertise.

This is **not** the paused BHFOS Cockpit and must not expand into accounting software, CRM automation, bank feeds, payroll processing, external integrations, or AI features.

The application must answer:

1. What does TVG cost to operate now and at each growth stage?
2. What revenue is required at each stage?
3. What production capacity and service mix support that revenue?
4. Are planned service prices sufficient under the modeled cost structure?
5. How are monthly actuals performing against plan?

## Locked presentation model

The app uses **exactly three presentation modes** over one authoritative financial engine:

### Guided

Primary maintenance experience for the finance partner.

Every editable section must tell the user:
- what to enter,
- where the number comes from,
- why it matters,
- what changing it affects,
- and the resulting business impact.

Use plain language first. Technical/accounting terminology may appear secondarily with explanation.

### Executive

Owner/operator decision view.

Emphasize:
- required revenue,
- production targets,
- cash/liquidity position,
- pricing health,
- growth-stage readiness,
- exceptions,
- and items requiring attention.

This view should be concise and action-oriented.

### Advanced Analytics

Preserve the original dashboard/analytics concepts. Do **not** delete deeper metrics in the name of simplicity.

This view is for deeper internal analysis and experienced advisors/mentors. It may expose:
- cost structure,
- capacity and utilization,
- service economics,
- working capital,
- margins,
- assumptions,
- trends,
- variances,
- scenario comparisons,
- and stage modeling.

There is **no fourth "Advisor" mode**. Advisors use Advanced Analytics.

## Reports

Reports are a separate function, not a fourth view.

Do not simply print the browser screen. Print/PDF output must remove app chrome, navigation, input controls, and tooltips.

Initial report presets:
- Monthly Financial Summary
- Owner Operating Report
- Cost Structure Report
- Growth Readiness Report
- Pricing & Service Economics
- Working Capital Report
- Assumptions Report
- Plan vs. Actual

Report controls should support appropriate combinations of:
- reporting period,
- plan / actual / plan-vs-actual,
- growth stage,
- executive / standard / detailed,
- charts,
- explanations,
- assumptions,
- management notes,
- detailed formulas.

## Progressive-disclosure rule

**Do not simplify by deleting information. Simplify by controlling when and how much information is exposed.**

Progression:

**Guided → Executive → Advanced Analytics**

with Reports available separately.

## Core navigation

Primary areas:
- Home
- Monthly Check-In
- Planning
- Reports

Within Planning, maintain the financial sections:
1. Overview
2. People & Payroll
3. Trucks & Equipment
4. Office & G&A
5. Growth & Protection
6. Production
7. Pricing
8. Growth Stages

## Growth-stage semantics — do not change

### Stage 0 — Current Solo
- Owner is primary field producer.
- No owner salary currently taken.
- Current cash baseline is approximately $2,350/month.
- Reality tracking only; not the long-term pricing basis.

### Stage 1 — Owner-Producer Team
- Owner remains a regular field producer and manager.
- Hired production team begins forming.
- Owner management compensation is modeled.
- Owner field labor is carried at replacement cost.

### Stage 2 — Owner GM + Field Reserve
- Owner's primary role is GM / sales / estimating / management.
- Routine production should not depend on owner field labor.
- Owner remains available for surge capacity, complex work, training, bottlenecks, and high-value projects.
- Do **not** describe Stage 2 as "owner never works in the field."

### Stage 3 — Full Production Units
- Route Services lane.
- Three-person Mechanical Hygiene / duct-cleaning crew.
- Licensed HVAC specialist lane when licensing supports it.
- Owner remains GM/sales/estimating + field reserve.

## Production-unit semantics — do not change

### Route Services
- Standard crew: 1 technician.
- Typical work: dryer vents, transition repairs, roof terminations, booster inspections, small commercial routes.
- Dense-route planning assumption: 4 stops/day.
- Working retail dryer-vent planning price: $285/job.

### Mechanical Hygiene
- 2 people can technically complete a whole-home duct cleaning.
- Preferred standard average-home crew: **3 people minimum** to reduce burnout and compress cycle time.
- Working duct floor: $125/drop.
- Working book-price input: $145/drop.
- Typical planning home: 12 drops.
- Target site clock: 3.5 hours.
- Stress site clock: 4.5 hours.

### HVAC / AHU — future and licensing-dependent
- Dedicated specialist: 1 HVAC-qualified technician.
- The fourth person on a duct + AHU package is **not extra duct labor**.
- AHU is separate revenue-producing scope.
- Working planning price: $795+.
- Working planning duration: approximately 3 hours.
- Must be visibly labeled **Future / Licensing Dependent** until intentionally changed.

### Combined duct + AHU
- Model as parallel production on the same site.
- 12-drop duct book planning price: 12 × $145 = $1,740.
- AHU planning price: $795.
- Combined planning ticket: $2,535.
- Capacity economics must count both production lanes.

## Seed capacity assumptions

| Input | Stage 0 | Stage 1 | Stage 2 | Stage 3 |
|---|---:|---:|---:|---:|
| Revenue-producing units | 1 | 2 | 2 | 3 |
| Working days/month | 20 | 20 | 20 | 20 |
| Realized utilization | 50% | 75% | 80% | 85% |
| Productive site hours/realized unit-day | 4 | 5 | 5 | 5 |

Stages 1–3:
- True operating profit target: 25%
- Growth/capital reserve: 5%
- Bad debt/warranty reserve: 2.5%
- Unidentified-cost contingency: 2.5%
- Total retention hurdle: 35%

## Seed staffing

| Role | Wage | Burden | S0 HC | S1 HC | S2 HC | S3 HC |
|---|---:|---:|---:|---:|---:|---:|
| Lead / Duct Technician | $28/hr | 22% | 0 | 1 | 1 | 1 |
| Duct Technician | $25/hr | 22% | 0 | 0 | 1 | 1 |
| Helper / Production Technician | $20/hr | 22% | 0 | 0.5 | 1 | 1 |
| Route Technician | $25/hr | 22% | 0 | 0 | 0 | 1 |
| HVAC Technician | $32/hr | 22% | 0 | 0 | 0 | 1 |
| Admin / CSR | $20/hr | 18% | 0 | 0.5 | 1 | 1 |
| Operations Coordinator | $25/hr | 18% | 0 | 0 | 0 | 0.5 |

Owner management compensation/month:
- S0 $0
- S1 $5,000
- S2 $7,000
- S3 $8,500

Owner field-replacement planning:
- Shadow field hours/month: 80, 80, 20, 8 for S0–S3.
- Replacement wage: $28/hr.
- Replacement burden: 22%.

## Current baseline and key non-labor seeds

Current:
- Truck payment: $530/month.
- Insurance: about $350/month.
- Fuel: $500/month.
- Other current operating bills: $970/month.
- Current cash baseline: $2,350/month.

Direct production non-labor:
- Fuel: 500 / 800 / 1,200 / 1,800
- Consumables: 0 / 400 / 800 / 1,500
- Job rentals/misc: 0 / 0 / 100 / 200

Indirect field overhead:
- Vehicle payments: 530 / 1,230 / 1,230 / 1,930
- Maintenance/tires: 0 / 350 / 500 / 900
- Equipment financing: 0 / 450 / 650 / 900
- Tooling/PPE: 0 / 250 / 350 / 500
- Replacement sinking fund: 0 / 500 / 750 / 1,250

Office/G&A:
- Office/shop/storage: 0 / 1,500 / 1,800 / 2,500
- Utilities/phone/internet: 0 / 450 / 500 / 700
- Software: 0 / 650 / 750 / 1,000
- Accounting/legal/tax: 0 / 400 / 500 / 750
- Office/admin misc: 970 / 250 / 300 / 450

Sales/BD:
- Marketing: 0 / 1,500 / 2,000 / 3,000
- Memberships/networking: 0 / 150 / 200 / 300
- Collateral/outreach: 0 / 100 / 150 / 250

Insurance/compliance:
- Package/GL planning: 350 / 450 / 500 / 650
- Commercial auto: 0 / 700 / 900 / 1,300
- Umbrella/excess: 0 / 275 / 350 / 500
- Licensing/certs/background/safety: 0 / 150 / 250 / 400

Workers' comp allowance already exists in field labor burden. Do not double-count a full WC premium unless an actual fixed/minimum cost is intentionally added.

## Channel/receivables seeds

| Channel | Share | DSO | Selling cost | Working vent price |
|---|---:|---:|---:|---:|
| Direct residential/COD | 50% | 3 days | 5% | $285 |
| Commercial direct/local PM | 30% | 35 days | 2% | $250 |
| Third-party portals | 20% | 65 days | 1% | $175 |

Planning assumptions only, not permanent policy.

## Historical snapshots

Monthly check-ins must preserve period snapshots so Advanced Analytics and Reports can later show:
- revenue trend,
- operating-cost trend,
- labor efficiency,
- average ticket,
- revenue/productive day,
- receivable days,
- working-capital requirements,
- margin movement,
- service-mix movement,
- actual vs planning assumptions.

## Monthly Check-In inputs

- Total Revenue
- Direct Residential Revenue
- Commercial Direct Revenue
- Portal Revenue
- Total Jobs
- Dryer Vent Jobs
- Duct Jobs
- AHU Jobs
- Productive Unit-Hours
- Field Payroll
- Indirect Cash Costs
- AR Ending
- Cash Reserve
- Notes

Derived:
- average ticket,
- revenue/productive hour,
- portal/direct share,
- jobs/productive hour,
- field payroll % revenue,
- indirect cost % revenue,
- AR/revenue,
- cash reserve/monthly revenue.

## Persistence

Use existing Supabase/auth stack. Do not add another backend.

Minimal model:
- `finance_plans`: tenant-scoped plan inputs/assumptions, version, audit timestamps/users.
- `finance_monthly_actuals`: one record per plan/month, tenant-scoped actual inputs.

Derived values are calculated from inputs and should not become competing authoritative stored fields.

## Security

- Authenticated only.
- Tenant-scoped reads/writes using existing TVG model.
- No anonymous writes.
- No service-role key in frontend.
- Reuse stronger existing authorization helpers if present.
- Add RLS/security evidence.
- Production migration execution remains separately authorized.

## UX requirements

Guided screens must explicitly communicate:
**What this is → What to enter → Why it matters → What it affects → Result**

Examples of user-facing terminology:
- "Office & Business Expenses" with secondary label "General & Administrative (G&A)"
- "Cash Needed While Waiting to Get Paid" with secondary label "Working Capital"
- "Employer Costs Above Wages" with secondary label "Payroll Burden"

Do not make the user infer what an input does.

## Print/report requirements

Print layouts must be purpose-built management reports.

Example report header:
- THE VENT GUYS
- report title
- period
- prepared for/by
- generated date

Report body may include:
- snapshot,
- Plan / Actual / Variance,
- key observations,
- management notes,
- assumptions/details depending on selected report level.

## Expected regression outputs

Approximate outputs with defaults:
- S0 required monthly revenue: $5,083
- S1 required monthly revenue: $43,644
- S2 required monthly revenue: $63,063
- S3 required monthly revenue: $97,987
- S1 revenue/available unit-day: $1,091
- S2 revenue/available unit-day: $1,577
- S1 revenue/productive unit-hour: $291
- S2 revenue/productive unit-hour: $394
- 12-drop working duct price at $145/drop: $1,740
- 12-drop duct + AHU: $2,535
- S2 duct target-cycle diagnostic: about $115/drop
- S2 duct stress-cycle diagnostic: about $148/drop
- rounded stress-test diagnostic: $150/drop

These are planning diagnostics, **not automatic customer pricing policy**.

## Testing / Definition of Done

Cursor must return:
- exact branch,
- exact commit SHA,
- files changed,
- migrations created,
- confirmation production migrations were not executed,
- confirmation production deploy was not executed,
- lint result,
- calculation/unit-test result,
- Playwright/smoke evidence,
- `npm run build:local` result,
- desktop visual evidence for Guided, Executive, Advanced Analytics, and Reports,
- mobile evidence for Guided Monthly Check-In and at least one Executive screen,
- RLS/security evidence if persistence is implemented,
- deviations from this handoff,
- unresolved questions.

Regression requirements:
- existing `/tvg/crm/*` behavior continues to work,
- invalid math never displays NaN/Infinity,
- saving and refresh preserve inputs,
- presentation-mode switching never changes underlying numbers,
- report output is not a screenshot of app chrome.

## Authorization boundary

Cursor may:
- inspect repo,
- create isolated branch,
- implement code,
- create migration files,
- run local tests/builds,
- produce evidence.

Cursor may **not**:
- deploy to production,
- execute production migrations,
- alter financial semantics,
- add external integrations,
- expand into Cockpit/accounting/AI,
- make material architecture/business-rule decisions.

Material ambiguity returns to Command Center.

## Source priority

1. This handoff for current product/UX semantics and authorized scope.
2. TVG v4 forward-cost model for formula intent.
3. Current BHFOS repository patterns for implementation mechanics/security/testing.
4. Original generated dashboard mockup for visual hierarchy only.

The original dashboard concepts are intentionally retained inside **Advanced Analytics**.

## Final instruction

Build a financial planning tool that a finance partner can maintain confidently while still preserving the analytical depth an owner or experienced mentor may need as TVG scales.

Do not trade away analytical capability merely to make Guided mode simple.
