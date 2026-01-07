# Deep Repo Audit: Public Web App
**Date:** 2025-12-05
**Scope:** Unauthenticated Routes (`src/pages`, `src/routes`)
**Status:** ⚠️ ISSUES FOUND (Fixes Applied)

## 1. Route Matrix & Health Check

| Route | Component | Status | Issues / Notes |
|-------|-----------|--------|----------------|
| `/` | `Home.jsx` | ✅ OK | Main landing. Links to Booking/Services working. |
| `/services` | `Services.jsx` | ⚠️ FIXED | Contained broken links to blog posts using legacy URL structure. Fixed via App.jsx aliases. |
| `/about` | `About.jsx` | ⚠️ FIXED | Broken internal links to safety articles. Fixed via App.jsx aliases. |
| `/contact` | `Contact.jsx` | ✅ OK | Uses `LeadCaptureForm`. |
| `/booking` | `Booking.jsx` | ✅ OK | Writes to `submissions` table. Different flow than Leads. |
| `/blog` | `Blog.jsx` | ⚠️ FIXED | Blog cards linked to non-existent root paths (e.g., `/nadca...`). Fixed via App.jsx aliases. |
| `/free-air-check` | `FreeAirCheckModal.jsx` | ❌ FAIL | Route rendered a Modal component without `open={true}` prop, resulting in a blank page. **FIXED**. |
| `/pricebook` | `Pricebook.jsx` | ✅ OK | Static pricing content. |
| `/partners` | `PartnersLanding.jsx` | ✅ OK | Navigation to sub-partner pages works. |
| `/estimate-wizard`| `EstimateWizard.jsx` | ✅ OK | Interactive tool, writes to `leads`. |
| `/service-areas/*`| `Melbourne.jsx` etc. | ✅ OK | 9 City pages verified. SEO content distinct. |

## 2. Critical Issues (P1 - High Priority)

### 🔗 Broken Internal Link Structure
*   **Problem:** High-traffic pages (`About.jsx`, `Services.jsx`, `Blog.jsx`) were linking to "Legacy SEO" URLs (e.g., `/nadca-standards-air-quality-protection`) that did not exist in the router. The actual content lived at `/blog/nadca-standards`.
*   **Impact:** Users clicking "Read More" or "Learn about Standards" hit 404s.
*   **Resolution:** Instead of refactoring 50+ hardcoded links across content files, I implemented **Route Aliasing** in `App.jsx`. These legacy paths now correctly render their respective Blog components.

### 👻 Ghost Route: `/free-air-check`
*   **Problem:** This route pointed to `FreeAirCheckModal` component directly. Since the router didn't pass the `open={true}` prop, the modal (Dialog) defaulted to closed/hidden, rendering a completely blank white page.
*   **Impact:** Marketing campaigns pointing here would bounce 100% of traffic.
*   **Resolution:** Updated `App.jsx` to pass forced props: `<FreeAirCheckModal open={true} />` when accessed via route.

## 3. Data & Form Integrity (P2 - Medium Priority)

### 🧩 Fragmented Data Ingestion
*   **Observation:** There are 3 different destinations for user data:
    1.  `Booking.jsx` -> `submissions` table (Supabase)
    2.  `EstimateWizard.jsx` & `FreeAirCheckModal.jsx` -> `leads` table (Supabase)
    3.  `LeadCaptureForm.jsx` (Contact Page) -> `EDGE_FUNCTION` (Fetch API)
    4.  `Partner Pages` -> `partner_registrations` table (Supabase)
*   **Risk:** Data silos. A contact request (Edge) might not appear in the same dashboard as a Booking (Table).
*   **Recommendation:** Consolidate `submissions` into `leads` in the next sprint. Ensure Edge Function also writes to `leads`.

### 📧 Dead Newsletter Form
*   **Problem:** The Footer newsletter input triggered a "Not Implemented" toast.
*   **Resolution:** Rewired to write to `leads` table with `service: 'Newsletter'` and `status: 'New'`.

## 4. Dead/Legacy Code (P3 - Low Priority)

### 🗑️ Quarantine List
The following components/files appear disconnected or redundant based on public route scan:
*   `src/pages/FreeAirCheck.jsx`: **AMBIGUOUS.** `App.jsx` imports the *Modal* for the route `/free-air-check` and the *Blog Post* for `/blog/free-air-check`. This naming collision is dangerous.
*   Recommendation: Rename blog post file to `src/pages/blog/FreeAirCheckArticle.jsx`.

## 5. Brand & Consistency
*   **Offers:** "Online Special $129" for Dryer Vent is consistently applied in Pricebook, Booking, and EstimateWizard. ✅
*   **Phone Numbers:** `(321) 360-9704` is consistent across headers, footers, and contact blocks. ✅