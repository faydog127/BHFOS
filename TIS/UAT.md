# TIS UAT Script (Operator Workflow Focus)

This script validates real field operator workflows for dryer vent safety targeting. It emphasizes evidence-based hazard data and field usability over generic UI checks.

## Severity Legend
- **Critical Fail**: Core workflow is broken. Stop field use until fixed.
- **Warning**: System is usable but degraded. Fix soon.

## Preconditions
1. Supabase schema updated with hazard fields (see `TIS/supabase-schema.sql`).
2. Supabase contains at least 3 assessments with dryer vent evidence in notes and photo tags.
3. Photo tags include at least one of: `lint_buildup`, `blocked_termination`, `safety_hazard`.
4. Local app can access Supabase (valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `TIS/.env`).

## Test Cases

## Results Log Template

| Test ID | Tester | Date | Result | Severity | Notes |
| --- | --- | --- | --- | --- | --- |
| UAT-001 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-002 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-003 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-004 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-005 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-006 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-007 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-008 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-009 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-010 |  |  | Pass / Fail | Critical / Warning |  |
| UAT-011 |  |  | Pass / Fail | Critical / Warning |  |

### UAT-001: Refresh from Supabase
**Purpose**  
Confirm that a refresh pulls the latest data into the local workspace.

**Severity**  
Warning

**Operator Impact**  
If this fails, the operator sees stale records and can’t trust the queue.

**Setup/Data Needed**  
At least one property and one assessment exist in Supabase.

**Steps**  
1. Open TIS and go to the Data Tools page.
2. Click `Refresh from Supabase`.
3. Wait for the success toast.

**Expected Result**  
Local data refreshes successfully and a success toast appears.

**Data State Validation**  
Confirm properties, assessments, and photos counts change or match Supabase counts.

**Pass/Fail Criteria**  
Pass if the refresh completes without error and the list updates. Fail if a Supabase error toast appears or data does not update.

### UAT-002: Auto-Backfill Hazard Scores After Refresh
**Purpose**  
Verify hazard scores auto-populate after a successful refresh.

**Severity**  
Critical Fail

**Operator Impact**  
If this fails, Top 5 lists remain zeroed and the operator works the wrong properties.

**Setup/Data Needed**  
At least 3 assessments with dryer vent evidence in notes or photos but `hazard_total = 0` in Supabase.

**Steps**  
1. From Data Tools, click `Refresh from Supabase`.
2. After the refresh completes, observe the Top 5 lists.
3. Check if hazard scores now appear on the cards.

**Expected Result**  
Hazard scores are populated automatically without manual edits, and the warning banner (if present) reduces or disappears.

**Data State Validation**  
Verify `hazard_total > 0` and `hazard_primary_angle` is non-empty for those assessments.

**Pass/Fail Criteria**  
Pass if hazard scores are filled and Top 5 lists populate with non-zero hazard scores. Fail if records remain zeroed without error.

### UAT-003: Hazard Scoring and Primary Angle Classification
**Purpose**  
Ensure hazard severity, prevalence, maintenance gap, and engagement path compute a correct Primary Angle.

**Severity**  
Warning

**Operator Impact**  
If this fails, the operator uses the wrong opening angle in the field.

**Setup/Data Needed**  
One assessment with clear “blocked/painted over” evidence and at least one `blocked_termination` or `safety_hazard` photo tag.

**Steps**  
1. Open the assessment.
2. Set Severity to 4.
3. Set Prevalence to 1 or 2.
4. Set Maintenance Gap to 2.
5. Set Engagement Path to 1 or 2.
6. Save the assessment.

**Expected Result**  
Primary Angle displays as **Safety** and hazard total is computed correctly.

**Data State Validation**  
Confirm `hazard_total` matches the sum of the four hazard fields and persists after reload.

**Pass/Fail Criteria**  
Pass if Primary Angle matches the expected label and total score updates. Fail if Primary Angle shows as Watch or does not update.

### UAT-004: Top 5 Active Target Queue Ranking and Filtering
**Purpose**  
Validate that the Active Target Queue reflects actionable properties and filter works.

**Severity**  
Critical Fail

**Operator Impact**  
If this fails, the operator wastes time on low-quality or non-actionable properties.

**Setup/Data Needed**  
At least 6 assessments with hazard scores > 0, mixed angles, mixed engagement path values.

**Steps**  
1. On Data Tools, review the Top 5 Targets list.
2. Confirm entries have hazard score > 0 and engagement path > 0.
3. Switch Angle Filter to `Safety + Repeat`.

**Expected Result**  
Only actionable records appear, and the filter narrows to Safety and Repeat Service entries.

**Data State Validation**  
Confirm each item shown has `hazard_total > 0` and `hazard_engagement_path > 0`.

**Pass/Fail Criteria**  
Pass if the queue excludes hazard=0, excludes engagement path=0, and filter limits results correctly. Fail if zero-score or non-actionable entries appear.

### UAT-005: Open Property from Top 5
**Purpose**  
Confirm operator can jump from Top 5 to the property detail page.

**Severity**  
Warning

**Operator Impact**  
If this fails, the operator can’t drill into details in the field.

**Setup/Data Needed**  
At least one Top 5 item visible.

**Steps**  
1. Click `Open Property` on a Top 5 card.

**Expected Result**  
Property detail page opens, showing property metadata and assessment history.

**Data State Validation**  
Confirm the property detail page shows the same property name as the Top 5 card.

**Pass/Fail Criteria**  
Pass if the correct property page opens. Fail if navigation breaks or wrong property opens.

### UAT-006: Mark Contacted → Move to B2B and Remove from Active
**Purpose**  
Verify that contacted properties leave the Active Target Queue and move to B2B.

**Severity**  
Critical Fail

**Operator Impact**  
If this fails, contacted properties reappear and the operator wastes time re-engaging them.

**Setup/Data Needed**  
At least one Top 5 property with hazard score > 0.

**Steps**  
1. Click `Mark Contacted → B2B Lead` on a Top 5 card.
2. Observe that the property disappears from Top 5 Active Targets.
3. Scroll to the B2B Leads section.

**Expected Result**  
Property is removed from Active and appears in B2B Leads with a contact timestamp.

**Data State Validation**  
Confirm `lead_status = b2b_lead` and `lead_contacted_at` populated for the property.

**Pass/Fail Criteria**  
Pass if the property moves to B2B and no longer appears in Active. Fail if it remains in Active or does not appear in B2B.

### UAT-007: Regression for Older V1 Records
**Purpose**  
Ensure older V1 records do not pollute Active Target Queue unless scored.

**Severity**  
Warning

**Operator Impact**  
If this fails, legacy records crowd out higher-signal properties.

**Setup/Data Needed**  
At least 3 V1 records without hazard scores.

**Steps**  
1. Open Data Tools.
2. Confirm V1 records are not present in Top 5 Active Targets.
3. Confirm the Missing Hazard warning appears if hazard_total = 0 records exist.

**Expected Result**  
V1 records are excluded from Active Targets until scored or backfilled.

**Data State Validation**  
Confirm V1 records still exist in the database but are not surfaced in Active Targets.

**Pass/Fail Criteria**  
Pass if V1 unscored records are excluded from Active Targets. Fail if they appear as Top 5 targets.

### UAT-008: Mobile-Width Sanity Check
**Purpose**  
Verify the Data Tools page remains field-usable on mobile width.

**Severity**  
Warning

**Operator Impact**  
If this fails, field usage slows or becomes unsafe due to poor visibility.

**Setup/Data Needed**  
Use browser DevTools with viewport width 390px or similar.

**Steps**  
1. Open DevTools responsive mode and set width to ~390px.
2. Navigate to Data Tools.
3. Scroll through Top 5 Targets and Top 5 Hazards.

**Expected Result**  
Cards and controls are readable, buttons are tappable, and no critical overflow occurs.

**Data State Validation**  
Not applicable.

**Pass/Fail Criteria**  
Pass if the page remains usable without clipped text or overlapping controls. Fail if any primary action or data is inaccessible.

### UAT-009: Hook Presence in Top 5
**Purpose**  
Ensure every Top 5 target has a usable field hook.

**Severity**  
Critical Fail

**Operator Impact**  
If this fails, the operator has no on-site talking point and loses momentum.

**Setup/Data Needed**  
At least 3 Top 5 targets with notes or hooks available.

**Steps**  
1. Load Top 5 Targets.
2. Inspect each card for a one-line hook.

**Expected Result**  
Each card displays a short hook line without opening the property detail.

**Data State Validation**  
Confirm the hook is sourced from `assessment.hook` or `property.seed_notes`.

**Pass/Fail Criteria**  
Pass if every Top 5 card includes a usable hook. Fail if any card lacks a hook.

### UAT-010: Ranking Integrity (Safety First)
**Purpose**  
Ensure strongest hazards appear above lower-severity properties.

**Severity**  
Critical Fail

**Operator Impact**  
If this fails, high-risk properties are deprioritized.

**Setup/Data Needed**  
At least one property with `safety_hazard` or `blocked_termination` evidence and another with only lint evidence.

**Steps**  
1. Identify the safety-risk property and the lower-severity property.
2. Compare their positions in Top 5 Targets.

**Expected Result**  
Safety-risk property ranks above lower-severity properties.

**Data State Validation**  
Verify the safety-risk property has higher hazard severity and total score.

**Pass/Fail Criteria**  
Pass if safety-ranked properties appear above lower-severity ones. Fail if lower severity outranks safety risk.

### UAT-011: Field Usability Speed
**Purpose**  
Validate the operator can decide quickly where to go and what to say.

**Severity**  
Warning

**Operator Impact**  
If this fails, field operations slow and engagement rate drops.

**Setup/Data Needed**  
Top 5 Targets list populated with hooks and evidence.

**Steps**  
1. Load Data Tools.
2. Identify the top property and its hook without opening any detail pages.
3. Note the time to decide the next action.

**Expected Result**  
Operator can decide within 5 seconds using the card info alone.

**Data State Validation**  
Not applicable.

**Pass/Fail Criteria**  
Pass if decision time is ≤ 5 seconds. Fail if it requires opening multiple screens or exceeds 5 seconds.
