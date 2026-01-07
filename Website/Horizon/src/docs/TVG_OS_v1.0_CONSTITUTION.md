# The Vent Guys Operating System (TVG OS) v1.0
**The Constitution & Master Protocol**

---

## 🏛️ Pillar 1: Strategic Mandate
**Positioning:** We are NOT "duct cleaners." We are **Mechanical Hygiene Experts**. We provide **medical-grade indoor air quality solutions** for high-performance homes and critical commercial facilities.

### The Standard 12 Rule
Every action, every pixel, every phone script must pass the "Standard 12" test:
> *"Does this look, feel, and sound like a company that charges 20% more than the market average because they are undeniably better?"*
If it looks cheap, it dies.

### The No-Fly Zone
We do not service:
1.  **Price Shoppers:** "How much for a cleaning?" calls are disqualified immediately unless converted to "Assessment First" mindset.
2.  **Band-Aid Fixes:** We do not patch flex duct with duct tape. We replace. We solve root causes.
3.  **Unsafe Conditions:** If a technician feels unsafe (roof pitch, attic heat, hoarding), they walk. Period.

### Hybrid Intake Protocol (Human + AI)
1.  **Klaire (AI Agent):** Handles initial triage, scheduling basics, and after-hours FAQ.
2.  **Human CSR:** Takes over for "High PQI" (Priority Qualification Index) leads > 80.
3.  **The Handoff:** Must be seamless. "Klaire has briefed me on your dryer vent issue..."

### Kill Switch Protocol
If a Partner (B2B) account becomes a "Financial Black Hole" (>60 days overdue invoice), the system automatically:
1.  Flags account with `chaos_flag: FINANCIAL_BLACK_HOLE`.
2.  Blocks all new dispatch requests.
3.  Triggers "Collections Mode" automated email/SMS sequence.

---

## 💾 Pillar 2: Data Architecture
The CRM is built on a **Property-First** logic, not Person-First. People move; buildings stay.

### The 5 Core Tables (The Holy Pentad)
1.  **Accounts (`accounts`):** The billing entity (Homeowner, Property Manager, Business).
2.  **Properties (`properties`):** The physical location. Has `vent_count`, `access_type`, `gate_codes`.
3.  **Contacts (`contacts`):** Humans associated with an Account. (Roles: Tenant, Owner, Maintenance Super).
4.  **Leads (`leads`):** A transient state. A potential business opportunity attached to a person or property.
5.  **Jobs (`jobs`):** The execution unit. The money maker.

### The Golden Record Rule
*   A Property can have multiple Leads over time.
*   A Lead MUST be converted to an Account + Job to be "Won".
*   Duplicate detection runs on `address1` + `zip`.

---

## 💰 Pillar 3: Revenue Engine
We do not sell time. We sell standardized outcomes.

### Good / Better / Best (GBB)
All estimates must be presented in a GBB format whenever possible:
1.  **Good:** The "I need it fixed now" minimum viable repair.
2.  **Better:** The "Standard of Care" (NADCA compliant cleaning + sanitizer).
3.  **Best:** The "Fortress Upgrade" (UV lights, Reme Halo, lifetime warranty components).

### Chain of Custody (Revenue Protection)
1.  **Estimate:** Created by CSR or Tech.
2.  **Quote:** Formal PDF sent to client. **MUST BE SIGNED.**
3.  **Job:** Created automatically upon Quote signature.
4.  **Invoice:** Generated from Job actuals.
5.  **Payment:** Closes the loop.

### Change Order Protocol
If a tech finds more work on-site:
1.  Tech updates Job Items in app.
2.  Tech captures **Photo Evidence** of new issue.
3.  Client signs "Change Order" on tablet.
4.  Work proceeds.

---

## 📊 Pillar 4: Command Center (Kanban)
The Kanban Board is the single source of truth for Operations.

### The 10 Commandments (Columns)
1.  **New Leads:** Fresh meat. SLA: 15 mins.
2.  **Contacted:** We tried. Ball is in their court.
3.  **Visit Scheduled:** Date/Time locked. Tech assigned.
4.  **Quote Sent:** Paperwork is out. Awaiting signature.
5.  **Ready to Book:** Signed! Dispatcher needs to slot it.
6.  **Scheduled Jobs:** Locked and loaded.
7.  **In Progress:** Tech is on site. (Status changed via Tech App).
8.  **Ready to Invoice:** Job done. Tech uploaded photos.
9.  **Awaiting Payment:** Invoice sent. Chasing money.
10. **Paid / Closed:** The Promised Land.

### Physics & Rules
*   **Gravity:** Cards naturally move left-to-right.
*   **Strict Transitions:** You cannot drag "New" to "Paid". You must pass through the gates (Quote, Job, Invoice).
*   **Zombie Protocol:** Cards sitting in "Quote Sent" > 30 days are automatically archived to keep the board clean.
*   **Color Logic:**
    *   **Green:** Fresh / Good.
    *   **Yellow:** Warning / 24hrs no touch.
    *   **Red:** Critical / SLA Breach / >48hrs no touch.

---

## 🎬 Pillar 5: Showtime Assets
Tools that make us look magical.

### The Web Wizard
A customer-facing, self-service portal where they can:
1.  Get an instant "Ballpark Estimate" (Range).
2.  Upload photos of their vents.
3.  Book a slot directly.

### The Digital Dossier (Tech View)
When a tech arrives, they don't just see "Clean vents." They see:
*   Gate Code.
*   "Beware of Dog (Killer)."
*   "Customer is an Engineer (explainer mode needed)."
*   History of past 3 visits.

---

## 🧠 Pillar 6: Humanware (SOPs)
Software enforces the process; Humans bring the empathy.

### The "White Glove" Script
*   **Greeting:** "Good morning, this is [Name] with The Vent Guys. I'm calling to confirm our arrival window..."
*   **The Shoe Cover Rule:** Techs put on shoe covers *before* stepping on the welcome mat. Visible respect.
*   **The "Show & Tell":** Tech must show the customer the "Before" photo and the "After" photo before asking for payment.

---

## ✅ Execution Checklist (v1.0 Launch)

- [x] **Database:** Supabase Schema Finalized (5 Core Tables).
- [x] **Auth:** Role-based access (Admin, CSR, Tech).
- [x] **Kanban:** strict drag-and-drop physics implemented.
- [x] **Modals:** All transition modals (Booking, Invoice, etc.) active.
- [x] **Popovers:** UI components fixed and operational.
- [x] **Tech View:** Mobile-optimized view for field ops.
- [ ] **Payments:** Stripe Integration (Next Phase).
- [ ] **AI Voice:** Bland AI / Vapi Integration (Next Phase).

*Signed and Ratified,*
**The Vent Guys Engineering Team**
*2025-12-09*