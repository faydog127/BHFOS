# Evidence Manifest (Pilot template)

> Fill one per **implementation** PR. Target &lt;5 minutes manual effort.
> Link artifacts; do not paste logs. Builder cannot self-certify executed claims
> without durable evidence.

| Field | Value |
| --- | --- |
| Authorized slice / scope | |
| Base SHA | |
| Head SHA | |
| Files changed | _(link `gh pr diff --name-only` or attach list)_ |
| Data objects changed | _(tables/RPCs/policies touched, or `none`)_ |
| Tests executed | _(commands + result links)_ |
| Tests skipped + reason | |
| Runtime environments tested | _(e.g. local node, disposable DB, none)_ |
| Claims proven by **execution** | |
| Claims supported by **source inspection only** | |
| Known residuals | |
| Rollback method | |
| Required reviewers + verdicts | |

**Evidence levels:** `SOURCE-ONLY` · `EXECUTED` · `USABLE` (owner/independent).  
Reviewers must not approve a claim above the level this manifest supports.
