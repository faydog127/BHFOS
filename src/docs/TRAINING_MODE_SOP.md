# Training Mode vs. Live Mode SOP

## Overview
This system has two distinct modes to prevent accidental changes to real customer data while allowing staff to learn the software.

### 1. Training Mode (Safety Sandbox)
**Indicator:** Yellow Banner at the top of the screen: "TRAINING MODE"
**What you see:** Only dummy/test data (fake names like "John Doe", "Test Corp").
**What you can do:**
- Create test leads and jobs.
- Drag cards around the pipeline.
- Send "fake" SMS/Emails (they are blocked and only logged to console).
- Run mock payments (stripe is bypassed).
**Safety:** Nothing you do here affects real money or real customers.

### 2. Live Mode (Real Business)
**Indicator:** No banner. Green "Live" toggle in the header.
**What you see:** Real customer data.
**What you can do:**
- Manage real jobs and payments.
**Risks:** Sending an email sends it for real. Charging a card charges it for real.

---

## How to Switch Modes
1. Look for the toggle switch in the top header (desktop) or menu (mobile).
2. Click to toggle between **Live** and **Training**.
3. A notification will confirm the switch.

## Rules for VAs and Staff
1. **Always Check the Banner:** Before clicking "Charge Card" or "Send Contract", look at the top of your screen. 
   - Yellow = Safe/Fake.
   - White/Clean = REAL.
2. **Training Data:** Never enter real customer phone numbers in Training Mode, just in case. Use `555-000-0000` numbers.
3. **If you make a mistake:** If you accidentally create a real lead in Training Mode, it will be marked as test data. An admin will need to fix it. If you create a test lead in Live Mode, please Archive it immediately with the reason "Internal Error".

## Troubleshooting
**"I can't see my test lead!"**
- Are you in Live Mode? Switch to Training.

**"I can't see the customer calling in!"**
- Are you in Training Mode? Switch to Live.

**"My drag and drop isn't working!"**
- If you are in Training Mode, you cannot move *Live* cards (if they somehow appear). The system blocks this to protect data integrity.