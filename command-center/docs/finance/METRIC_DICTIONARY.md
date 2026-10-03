# Canonical metric dictionary

One definition each. Consumers may display these names. They may not invent a second formula.

Finance date basis, unless a row says otherwise, is the reporting month on `finance_monthly_actuals.month` (`YYYY-MM-01`): work completed or recognized in that month, or a month-end balance. Blank stays null. Zero stays zero. Division uses the existing null-safe `div` (null stays null, divide-by-zero stays null).

These definitions restate Command Center rulings already in force. They do not add financial semantics.

| Canonical name | Definition | Date basis | Store |
|---|---|---|---|
| Earned operating revenue | Money earned for work completed in the reporting month. Not invoice issue-date volume, not cash collected, not a quoted price, and not a scheduled price. The Business Analytics sum of appointment `pricing_snapshot.price` is not this metric. | Reporting month | `finance_monthly_actuals.total_revenue` |
| Direct residential revenue | Earned operating revenue for direct residential work completed in the month. Same meaning as earned operating revenue. | Reporting month | `direct_residential_revenue` |
| Commercial direct revenue | Earned operating revenue for commercial direct work completed in the month. Same meaning as earned operating revenue. | Reporting month | `commercial_direct_revenue` |
| Portal revenue | Earned operating revenue for portal work completed in the month. Same meaning as earned operating revenue. | Reporting month | `portal_revenue` |
| Invoiced amount | Invoice issue-date volume. Distinct from earned operating revenue. | Not defined here | No Finance column and no authorized integration |
| Cash collected | Cash received. Distinct from earned operating revenue and from cash reserve. | Not defined here | No Finance column and no authorized integration |
| Jobs completed | Manual count of jobs completed in the reporting month. Not the Business Analytics count of completed appointments by `scheduled_start`. | Reporting month | `total_jobs` |
| Average ticket | Earned operating revenue divided by jobs completed. Null when either input is null or jobs are zero. | Reporting month | Derived only (`div(total_revenue, total_jobs)`) |
| Productive unit-hours | Hours the production units actually worked in the reporting month. Not inferred from appointments. | Reporting month | `productive_unit_hours` |
| Revenue / productive hour | Earned operating revenue divided by productive unit-hours. Null when either input is null or hours are zero. | Reporting month | Derived only |
| Channel share | Portal share is portal revenue divided by earned operating revenue. Direct share is (direct residential + commercial direct) divided by earned operating revenue. Both stay null unless all three channel amounts are present. A missing channel is not zero. | Reporting month | Derived only |
| Field payroll % revenue | Field payroll (cash paid to field crews) divided by earned operating revenue. Null when either input is null or revenue is zero. | Reporting month | Derived from `field_payroll` and `total_revenue` |
| AR | Unpaid invoices at month end. A balance, not earned revenue and not invoiced amount for the month. | Month end | `ar_ending` |
| Cash reserve | Cash on hand at month end. A balance, not cash collected during the month. | Month end | `cash_reserve` |

Channel rule already enforced on the actual: when all three channel amounts are present they equal earned operating revenue; when earned operating revenue is present, the sum of the known channel amounts cannot exceed it.

## Unresolved questions for Command Center

- Invoiced amount and cash collected have no Finance store and no authorized source. This dictionary does not invent a formula, a table, or a date rule for them. Are they to stay undefined until a later ruling?
- Business Analytics still shows the operational scheduled-appointment-price sum under a corrected label. Should that series stay visible, or be hidden until Operational Analytics owns it separately?
