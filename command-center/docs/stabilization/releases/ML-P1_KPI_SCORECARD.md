# ML-P1 KPI Scorecard

> Planning correction artifact. **Does not authorize implementation.**
> **Baseline-first rule:** where Target is `BASELINE_FIRST`, run a measurement window
> (default 2–4 weeks or one Founder-authorized trial set) before locking numeric targets.
> CI green is **not** a usability or financial KPI.

Owners below are role titles; assign named humans at implementation auth.

---

## A. Business outcomes

| Metric | Definition | Baseline | Target | Source | Owner | Cadence | Success | Redesign | L/L | Bad-incentive risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer requests captured | Count of new leads/requests entering CRM in period | Measure | `BASELINE_FIRST` then ↑ | CRM lead create events | Ops lead | Weekly | Trend up without quality drop | Inflated junk leads | Lagging | Gaming via empty leads |
| Estimates created | Count of issued/draft quotes on canonical `quotes` path | Measure | `BASELINE_FIRST` | `quotes` rows + events | Money-loop | Weekly | Stable/↑ on canonical path | Dual-path inflation | Lagging | Creating drafts to game count — prefer **issued** sub-metric |
| Estimate approval rate | Approved ÷ issued (canonical quotes) | Measure | `BASELINE_FIRST` | Quote status transitions | Founder | Monthly | Improve without lowering quality | Pressure approvals | Lagging | Approving bad jobs |
| Estimate→job conversion | Jobs created ÷ approved quotes | Measure | `BASELINE_FIRST` + **100%** on P1 test set | Join quote↔job | Money-loop | Per slice + weekly | 100% on test set; prod trend | Silent non-conversion | Lagging | Fake jobs |
| Jobs completed | Completions on authorized transitions | Measure | `BASELINE_FIRST` | Job state events | Field lead | Weekly | Trend with evidence complete | Completing without evidence | Lagging | Skip photos to speed close |
| Invoices issued | Issued invoices (not draft) | Measure | `BASELINE_FIRST` | Invoice status | Money-loop | Weekly | Matches completed billable scope | Invoice without completion | Lagging | Premature issue |
| Invoice→payment conversion | Paid ÷ issued | Measure | `BASELINE_FIRST` then ↑ | Invoice+payment | Finance ops | Monthly | Improve on S5b+ | Push fake paid | Lagging | Alternate paid writers |
| Automation failure rate | Failed automations÷runs | Measure | Visible; near 0 | S6 automation log | Ops | Daily | No silent fail | Silent fail | Lagging | Disabling automation |
| Follow-up time-to-first | Median hours trigger→first chase | Measure | `BASELINE_FIRST` then ↓ | S6 runs | Ops | Weekly | Down | Spam risk | Leading | — |
| Payment fail recovery rate | Recovered÷failed pays | Measure | `BASELINE_FIRST` then ↑ | S5b | Finance | Weekly | Up | Ignoring fails | Lagging | — |
| Refund/void with audit | % refunds/voids with complete audit | N/A | **100%** when used | S5b events | Finance | Weekly | 100% | Missing audit | Lagging | — |
| Request→estimate time | Median hours request→first issued quote | Measure | `BASELINE_FIRST` then ↓ | Timestamps | Ops | Weekly | Down vs baseline | Skip required fields | Leading | Incomplete estimates |
| Approval→job time | Median approved→job created | Measure | Near-immediate on path; measure | Events | Money-loop | Per slice | Idempotent same-session create | Manual delay OK if owned | Leading | — |
| Completion→invoice time | Median complete→invoice issued | Measure | `BASELINE_FIRST` then ↓ | Events | Money-loop | Weekly | Down without skipping lineage | Invoice before complete | Leading | — |
| Request→invoice cycle time | Median request→issued invoice | Measure | `BASELINE_FIRST` then ↓ | Timestamps | Ops | Weekly | Down with lineage 100% | Skip steps | Lagging | Shortcut integrity |
| Avg approved estimate value | Mean amount on approved quotes | Measure | Contextual; watch outliers | Quotes | Founder | Monthly | Informational | Discount gaming | Lagging | Inflating then voiding |
| Avg invoiced value | Mean issued invoice total | Measure | Align with approved | Invoices | Finance | Monthly | Lineage match | Padding invoices | Lagging | — |
| Abandoned opportunities | Issued not approved within expiry window | Measure | `BASELINE_FIRST` then ↓ | Quote states | Ops | Weekly | Down | Auto-approve to clear | Lagging | — |

---

## B. Field usability

| Metric | Definition | Baseline | Target | Source | Owner | Cadence | Success | Redesign | L/L | Bad-incentive risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Time to create/find customer | Stopwatch/telemetry P50 | Measure | Cap after baseline | Trial log / telemetry | UX | Trial | Cap met | Cap miss → simplify | Leading | Skipping search→dupes |
| Time to create estimate | P50 create issued/draft quote | Measure | Cap after baseline | Trial | UX | Trial | Cap met | Cap miss | Leading | Incomplete quotes |
| Time to complete job record | P50 evidence-complete close | Measure | Cap after baseline | Trial | UX / field | Trial | Cap met with evidence | Cap miss or evidence skip | Leading | Skip evidence |
| Taps/screens per core task | Count for find customer, quote, complete, invoice | Measure | ↓ or hold | Task analysis | UX | Per slice | Documented budget | Budget creep | Leading | Hidden destructive shortcuts |
| Task-completion rate | % trials finished without abandon | Measure | High on P1 path | Observation | UX | Trial | Founder+tech succeed | Abandon → redesign | Leading | — |
| Mobile abandonment rate | % starts without finish | Measure | ↓ | Funnel | UX | Weekly | Down | — | Leading | — |
| Notes/text/paper escape rate | % P1 path trials needing external tools | Measure | **0%** on acceptance trials | Observation diary | Founder + field | Each acceptance | 0 on gate trials | Any escape on gate → fail | Leading | Forbidding notes without usable app |
| Duplicate-entry count | Re-typed fields on P1 path | Measure | **0** on path | Checklist | Money-loop | Per slice | 0 | Re-entry found | Leading | — |
| Technician help requests | Assists per trial | Measure | 0 admin rescue on gate | Observation | Field | Trial | 0 | Help needed → UX fix | Leading | — |
| Errors recovered without admin | User self-recovers vs ticket | Measure | ↑ self-recover | Support log | UX | Weekly | Most errors self-serve | Chronic admin rescue | Leading | Hiding errors |

---

## C. Process quality

| Metric | Definition | Baseline | Target | Source | Owner | Cadence | Success | Redesign | L/L | Bad-incentive risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Duplicate customer rate | Suspected dupes ÷ new customers | Measure | Cap after baseline | Dedup report | Data | Weekly | Below cap | Spike | Lagging | Blocking creates harshly |
| Duplicate property rate | Same | Measure | Cap after baseline | Dedup | Data | Weekly | Below cap | Spike | Lagging | — |
| Duplicate job rate | Dup jobs per accept/retry | Measure / harness | **0** under retry tests | Harness + DB | Money-loop | Per slice | 0 | Any dup job | Lagging | — |
| Duplicate invoice rate | Dup invoices per retry | Measure / harness | **0** | Harness | Money-loop | Per slice | 0 | Any dup | Lagging | — |
| Failed state-transition rate | Failed÷attempted money transitions | Measure | Near 0 + alerted | Ops logs | Ops | Daily | Alerted & owned | Unowned failures | Lagging | Swallowing errors |
| Stale approvals | Approved past expiry still open | Measure | 0 or owned | Quote query | Ops | Weekly | None unowned | — | Lagging | — |
| Unowned jobs | Active jobs without assignee/owner | Measure | 0 | Job query | Field | Daily | 0 | — | Lagging | — |
| Manual re-entry points | Count on P1 path | Inventory | **0** | Design review | Money-loop | Per slice | 0 | Any | Leading | — |
| Incomplete completion evidence | Completes missing required artifacts | Measure | **0** on P1 path if gate on | Job evidence | Field | Per slice | 0 | — | Lagging | Disabling gate |
| Invoice exception rate | Exceptions÷issued | Measure | Near 0 owned queue | Exception queue | Finance | Daily | Owned &lt;SLA | Unowned overnight | Lagging | — |
| Automation failure rate | Failed automations÷runs | Measure | Visible; near 0 | S6 automation log | Ops | Daily | No silent fail | Silent fail | Lagging | Disabling automation |
| Recovery time | MTTRmoney-state error | Measure | `BASELINE_FIRST` then ↓ | Incident log | Ops | Monthly | Down | — | Lagging | — |

---

## D. Financial and control integrity

| Metric | Definition | Baseline | Target | Source | Owner | Cadence | Success | Redesign | L/L | Bad-incentive risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Estimate–job–invoice lineage completeness | % P1 test txs with full ID/version lineage | N/A (gate) | **100%** | Joins + events | Money-loop | Per slice | 100% | Any break | Lagging | — |
| Approved-estimate version match | Invoice/job scope matches approved quote version | N/A | **100%** on P1 tests | Version pins | Money-loop | Per slice | 100% | Drift | Lagging | Editing after approve |
| Unauthorized transition attempts | Count blocked vs any success | N/A | **0** successes | Authz tests/logs | Security | Per PR | 0 success | Any success | Lagging | — |
| Issued-invoice mutation attempts | Blocked illegal edits | N/A | **0** successes | Tests | Money-loop | Per slice | 0 | Any success | Lagging | — |
| Void/adjust reason-code coverage | % voids/corrections with reason | Measure | **100%** when used | Invoice events | Finance | Weekly | 100% | Missing reason | Lagging | Dummy reasons |
| Reconciliation exceptions | Open exceptions | Measure | 0 unowned | Queue | Finance | Daily | 0 unowned | — | Lagging | — |
| Partial/incomplete transaction rate | Partial commits detected | Harness | **0** | Failure injection | Money-loop | Per slice | 0 | Any | Lagging | — |
| Time to detect money-state error | Detection latency | Measure | `BASELINE_FIRST` then ↓ | Alerts | Ops | Monthly | Down | — | Leading | Noisy alerts |
| Time to resolve money-state error | Resolve latency | Measure | `BASELINE_FIRST` then ↓ | Incidents | Ops | Monthly | Down | — | Lagging | — |
| Audit-event completeness | Required fields present on required transitions | N/A | **100%** | Event store | Platform | Per slice | 100% | Gap | Lagging | Optional fields gamed |

---

## Measurement notes

1. **P1 test set** = Founder-authorized scripted transactions used for blocking gates (not vanity production volume).
2. **USABLE** requires real-device Founder + technician acceptance; never CI alone.
3. Bad-incentive column must be reviewed when adding any new metric.
