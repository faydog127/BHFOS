# Business Analytics inventory

Scope is only the live `/crm/reporting` tree. `App.jsx` route `reporting` renders `Reporting.jsx`, which renders `AnalyticsDashboard` and does not calculate metrics. `pages/crm/Crm.jsx` also contains a `reporting` route, and nothing imports that file. It is not an active surface. This inventory is the live dashboard as of Stage C1.

Date window for every queried series: the selected range (`7d`, `30d`, `90d`, `ytd`, `12m`), default 30 days, ending at the end of the current local day. That window is not the Finance reporting month.

Hard-coded measurements are not Finance authority and must not be copied into Finance Advanced Analytics. A source grep cannot catch a derived fabrication such as `0.3 * revenueTotal`.

| Metric | Source | Calculation | Date basis | Class | Domain | Disposition |
|---|---|---|---|---|---|---|
| Scheduled appointment price (card total) | `appointments` select `*`, `tenant_id`, `scheduled_start` in the window | Sum of finite `pricing_snapshot.price` for `status === 'completed'`, only when every contributing price is finite. A missing or non-finite price makes the card and series `unavailable / not connected`. A successful query with no completed rows is a measured 0. A query error is unavailable, not 0. The card uses neutral slate styling. | `scheduled_start` | Derived operational amount | Operational Analytics | Keep the queried sum only when every price is finite. Do not call it earned operating revenue. |
| Scheduled appointment price period change | None | Previously hard-coded `12.5` and always "up" | None | Hard-coded | Unsupported | Retired. Shows `unavailable / not connected`. |
| Scheduled appointment price trend chart | Same completed appointments | Group the same price sum by `scheduled_start` formatted `MMM d`. The chart is hidden when the price series is incomplete or the query failed. | `scheduled_start` | Derived | Operational Analytics | Keep when the series is complete. Chart and CSV label it scheduled appointment price, not Revenue. |
| CSV export | The trend series above | Columns Date, Metric, Value | `scheduled_start` | Derived | Operational Analytics | Keep, with the scheduled-price metric name. |
| Work orders completed | Same appointments query | Count of `status === 'completed'` | `scheduled_start` | Derived count | Operational Analytics | Keep the count. It is not Finance `total_jobs`. |
| Average duration | None | Previously 75 minutes when any job was completed, else 0. Not computed from timestamps. | None | Hard-coded | Unsupported | Retired. Shows `unavailable / not connected`. |
| Work-order trend | None | Previously `+8%` and always up | None | Hard-coded | Unsupported | Retired. Shows `unavailable / not connected`. |
| New leads | `leads` select `*`, `tenant_id`, `created_at` in the window | `leads.length` | `created_at` | Raw count | CRM | Keep. |
| Lead conversion rate | None | Retired. The mixed appointment and lead ratio is not shown, including as 0%. | None | Unsupported | CRM | Shows `unavailable / not connected`. |
| Lead trend | None | Previously `-2.5%` and always down | None | Hard-coded | Unsupported | Retired. Shows `unavailable / not connected`. |
| Average rating | None | Previously 4.8 from 24 reviews, trend `+0.2`. No reviews query. | None | Hard-coded | Unsupported | Retired. Card stays and shows `unavailable / not connected`. |
| Customer sentiment | None | Previously Promoter 65 / Neutral 25 / Detractor 10 | None | Hard-coded | Unsupported | Pie removed. Card shows `unavailable / not connected`. |
| Health score | None | Previously 88 | None | Hard-coded | Unsupported | Removed with the pie. Not replaced with another score. |
| Top referral partners | `referrals` select `*, referral_partners(name)`, `tenant_id`, `created_at` in the window | Count by partner name, top 5. Empty state when none. | `created_at` | Derived | Marketing | Keep. |
| Referral commissions | Same referrals rows | Sum of `commission_amount` (missing coerced to 0). Computed and not charted. | `created_at` | Derived, not displayed | Marketing | Not displayed. Do not treat the hidden sum as a Finance figure. |
| Work order completion status | Same appointments query | Counts of `completed`, `cancelled`, and `no_show` when that query succeeded. A query error shows `unavailable / not connected`. | `scheduled_start` | Derived | Operational Analytics | Keep only for a successful query. |
| Customers total / repeat rate | None | Previously 1250 and 32. Stored and never rendered. | None | Hard-coded | Unsupported | Removed from state. |
| Lead source chart | None | Initialized empty and never filled or rendered. | None | Unsupported | Unsupported | Removed from state. |

A query error or a thrown fetch sets the affected metrics to `unavailable / not connected`. Invoiced amount and Cash collected stay unavailable. Referral `commission_amount` still uses `|| 0` inside the uncharted partner tally.
