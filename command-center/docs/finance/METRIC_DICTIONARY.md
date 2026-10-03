# Canonical metric dictionary

One definition each. Consumers may display these names. They may not invent a second formula.

Finance date basis, unless a row says otherwise, is the reporting month on `finance_monthly_actuals.month` (`YYYY-MM-01`): work completed or recognized in that month, or a month-end balance. Blank stays null. Zero stays zero. Division uses the existing null-safe `div` (null stays null, divide-by-zero stays null). A zero numerator with a positive denominator stays zero.

Units already used by the check-in store and display: money is USD to the cent (`numeric(14,2)`); hours are decimal hours to `0.01`; counts are whole jobs; a share is a fraction of 1 and the screen formats it as a percent. Those units are storage and display facts, not a new financial rule.

These definitions restate Command Center rulings already in force and the existing `derivedActualMetrics` formulas. They do not add financial semantics.

| Canonical name | Definition | Date basis | Unit | Denominator | Store |
|---|---|---|---|---|---|
| Earned operating revenue | Money earned for work completed in the reporting month. Not invoice issue-date volume, not cash collected, not a quoted price, and not a scheduled price. The Business Analytics sum of appointment `pricing_snapshot.price` is not this metric. | Reporting month | USD, cents | None | `finance_monthly_actuals.total_revenue` |
| Direct residential revenue | Earned operating revenue for direct residential work completed in the month. Same meaning as earned operating revenue. | Reporting month | USD, cents | None | `direct_residential_revenue` |
| Commercial direct revenue | Earned operating revenue for commercial direct work completed in the month. Same meaning as earned operating revenue. | Reporting month | USD, cents | None | `commercial_direct_revenue` |
| Portal revenue | Earned operating revenue for portal work completed in the month. Same meaning as earned operating revenue. | Reporting month | USD, cents | None | `portal_revenue` |
| Invoiced amount | Invoice issue-date volume. Distinct from earned operating revenue. | Not defined here | Not defined here | Not defined here | No Finance column and no authorized integration |
| Cash collected | Cash received. Distinct from earned operating revenue and from cash reserve. | Not defined here | Not defined here | Not defined here | No Finance column and no authorized integration |
| Jobs completed | Manual count of jobs completed in the reporting month. Not the Business Analytics count of completed appointments by `scheduled_start`. | Reporting month | Whole jobs | None | `total_jobs` |
| Average ticket | Earned operating revenue divided by jobs completed. Null when either input is null or jobs are zero. | Reporting month | USD, cents | Jobs completed | Derived only (`div(total_revenue, total_jobs)`) |
| Productive unit-hours | Hours the production units actually worked in the reporting month. Not inferred from appointments. | Reporting month | Hours, 0.01 | None | `productive_unit_hours` |
| Revenue / productive hour | Earned operating revenue divided by productive unit-hours. Null when either input is null or hours are zero. | Reporting month | USD, cents | Productive unit-hours | Derived only |
| Jobs per productive hour | Jobs completed divided by productive unit-hours. Null when either input is null or hours are zero. Zero jobs with positive hours stays zero. | Reporting month | Jobs per hour | Productive unit-hours | Derived only (`div(total_jobs, productive_unit_hours)`) |
| Channel share | Portal share is portal revenue divided by earned operating revenue. Direct share is (direct residential + commercial direct) divided by earned operating revenue. Both stay null unless all three channel amounts are present. A missing channel is not zero. | Reporting month | Fraction of 1 | Earned operating revenue | Derived only |
| Field payroll | Cash paid to field crews in the reporting month. | Reporting month | USD, cents | None | `field_payroll` |
| Field payroll % revenue | Field payroll divided by earned operating revenue. Null when either input is null or revenue is zero. | Reporting month | Fraction of 1 | Earned operating revenue | Derived from `field_payroll` and `total_revenue` |
| Indirect cash costs | Other cash costs that are not field payroll. The check-in label is the whole definition. What belongs in the bucket is not further ruled. | Reporting month | USD, cents | None | `indirect_cash_costs` |
| Indirect cost % revenue | Indirect cash costs divided by earned operating revenue. Null when either input is null or revenue is zero. | Reporting month | Fraction of 1 | Earned operating revenue | Derived only (`div(indirect_cash_costs, total_revenue)`) |
| AR | Unpaid invoices at month end. A balance, not earned revenue and not invoiced amount for the month. | Month end | USD, cents | None | `ar_ending` |
| AR / revenue | Ending AR divided by earned operating revenue. Null when either input is null or revenue is zero. | Month-end balance over the reporting month | Fraction of 1 | Earned operating revenue | Derived only (`div(ar_ending, total_revenue)`) |
| Cash reserve | Cash on hand at month end. A balance, not cash collected during the month. | Month end | USD, cents | None | `cash_reserve` |
| Cash reserve / revenue | Cash reserve divided by earned operating revenue. Null when either input is null or revenue is zero. | Month-end balance over the reporting month | Fraction of 1 | Earned operating revenue | Derived only (`div(cash_reserve, total_revenue)`) |

Channel rule already enforced on the actual: when all three channel amounts are present they equal earned operating revenue; when earned operating revenue is present, the sum of the known channel amounts cannot exceed it.

## Unresolved questions for Command Center

- Invoiced amount and cash collected have no Finance store and no authorized source. This dictionary does not invent a formula, a table, or a date rule for them. Are they to stay undefined until a later ruling?
- Business Analytics still shows the operational scheduled-appointment-price sum under a corrected label. Should that series stay visible, or be hidden until Operational Analytics owns it separately?
- Dryer vent, duct, and AHU job counts are stored manual counts with check-in labels. There is no separate ruling that distinguishes them from jobs completed. Should they stay unlabeled counts until Command Center defines them?
- Indirect cash costs are only "other cash costs that are not field payroll." Which costs belong there is not ruled.
