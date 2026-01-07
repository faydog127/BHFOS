# HVAC/IAQ Partner Vertical v1.0 Operations Guide

## 1. Chaos Flags & Protocols
| Chaos Flag Type | Mandated Script & Action |
| :--- | :--- |
| `HARD_COMPETITOR` | **Script:** "Hi... our system indicates your firm is a direct competitor... we maintain a strict non-solicitation policy..." <br/> **Action:** Terminate Call |
| `GEOGRAPHIC_VAMPIRE` | **Script:** "Hi... Looking at your project locations, it appears you operate primarily outside our insured service radius..." <br/> **Action:** Refer & Archive |
| `ETHICS_BREACH` | **Script:** "We are terminating this engagement due to a documented violation of our safety and ethics protocols..." <br/> **Action:** Immediate Block |
| `FINANCIAL_BLACK_HOLE` | **Script:** "Calling regarding invoice... now over 60 days past due. Our system has placed a credit hold..." <br/> **Action:** Collect Payment |
| `ABUSE_PROTOCOL` | **Script:** "Terminating this call... your language violates our staff protection policy." <br/> **Action:** Hang Up & Log |

## 2. Call Console States
*   **GREEN (System Green):** Partner in good standing. Standard protocols.
*   **YELLOW (Credit Hold/At Risk):** Overdue invoices (>60 days) or engagement drop. "DO NOT BOOK" warning.
*   **RED (Chaos Protocol):** Active chaos flag. Mandatory script execution.

## 3. Partner Lifecycle
*   **ACTIVE:** Referral < 60 days.
*   **AT_RISK:** Referral 60-90 days. Triggers "Wake Up" task.
*   **DORMANT:** Referral > 90 days.