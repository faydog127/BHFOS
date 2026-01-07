# Master Routing Audit Report
**Generated:** 2025-12-15
**Status:** Review Required
**Router Version:** React Router v6

## 1. Executive Summary
The application currently uses a split routing strategy. The core public website and the new "Enterprise" CRM pages are correctly wired in `App.jsx`. However, a significant portion of the legacy CRM functionality (Inbox, Marketing, Jobs, etc.) which was previously handled by `src/pages/crm/Crm.jsx` is **currently detached** from the main router.

- **Active Router:** `src/App.jsx` (Primary Source of Truth)
- **Detached Router:** `src/pages/crm/Crm.jsx` (Sub-router currently unused)
- **Route Guard:** `AdminRoute` (Supabase Authentication)

## 2. Active Routing Tree (App.jsx)

### Public Pages (Unprotected)
| Route Path | Component File | Purpose | Status |
|---|---|---|---|
| `/` | `src/pages/Home.jsx` | Landing Page | ✅ Active |
| `/services` | `src/pages/Services.jsx` | Services Overview | ✅ Active |
| `/about` | `src/pages/About.jsx` | Company Info | ✅ Active |
| `/contact` | `src/pages/Contact.jsx` | Contact Form | ✅ Active |
| `/booking` | `src/pages/Booking.jsx` | Online Booking | ✅ Active |
| `/blog` | `src/pages/Blog.jsx` | Blog Index | ✅ Active |
| `/faq` | `src/pages/Faq.jsx` | FAQ | ✅ Active |
| `/gallery` | `src/pages/Gallery.jsx` | Work Gallery | ✅ Active |
| `/privacy` | `src/pages/PrivacyPolicy.jsx` | Legal | ✅ Active |
| `/thank-you` | `src/pages/ThankYou.jsx` | Success Page | ✅ Active |
| `/login` | `src/pages/Login.jsx` | Auth Entry | ✅ Active |

### Service Areas (SEO)
| Route Path | Component File | Status |
|---|---|---|
| `/service-areas/melbourne` | `src/pages/Melbourne.jsx` | ✅ Active |
| `/service-areas/merritt-island` | `src/pages/MerrittIsland.jsx` | ✅ Active |
| `/service-areas/new-smyrna-beach` | `src/pages/NewSmyrnaBeach.jsx` | ✅ Active |
| `/service-areas/port-st-john` | `src/pages/PortStJohn.jsx` | ✅ Active |
| `/service-areas/rockledge` | `src/pages/Rockledge.jsx` | ✅ Active |
| `/service-areas/suntree` | `src/pages/Suntree.jsx` | ✅ Active |
| `/service-areas/titusville` | `src/pages/Titusville.jsx` | ✅ Active |
| `/service-areas/viera` | `src/pages/Viera.jsx` | ✅ Active |
| `/service-areas/cocoa` | `src/pages/Cocoa.jsx` | ✅ Active |

### Partner Pages
| Route Path | Component File | Status |
|---|---|---|
| `/partners` | `src/pages/PartnersLanding.jsx` | ✅ Active |
| `/partners/realtor` | `src/pages/partners/RealtorPartner.jsx` | ✅ Active |
| `/partners/property-manager` | `src/pages/partners/PropertyManagerPartner.jsx` | ✅ Active |
| `/partners/*` | (Various Partner Types) | ✅ Active |

### Enterprise CRM (Protected via AdminRoute)
These routes utilize the new `EnterpriseLayout`.

| Route Path | Component File | Functionality | Status |
|---|---|---|---|
| `/crm` | `src/pages/crm/Dashboard.jsx` | Executive Dashboard | ✅ Active |
| `/crm/calls` | `src/pages/crm/CallsPage.jsx` | Smart Call Console | ✅ Active |
| `/crm/contacts` | `src/pages/crm/ContactsPage.jsx` | Contact Management | ✅ Active |
| `/crm/leads` | `src/pages/crm/LeadsPage.jsx` | Lead Pipeline | ✅ Active |
| `/crm/deals` | `src/pages/crm/DealsPage.jsx` | Deal Tracking | ✅ Active |
| `/crm/reports` | `src/pages/crm/ReportsPage.jsx` | Analytics | ✅ Active |
| `/crm/settings` | `src/pages/crm/SettingsPage.jsx` | System Settings | ✅ Active |

### Diagnostics & Admin Tools (Protected)
| Route Path | Component File | Status |
|---|---|---|
| `/crm/backend-test` | `src/pages/crm/BackendTest.jsx` | ✅ Active |
| `/crm/advanced-diagnostics` | `src/components/crm/settings/AdvancedDiagnostics.jsx` | ✅ Active |
| `/system-doctor` | `src/components/SystemDoctorConsole.jsx` | ✅ Active |
| `/bhf/master-diagnostics` | `src/pages/bhf/MasterDiagnostics.jsx` | ✅ Active |
| `/bhf/improvement-analysis` | `src/pages/bhf/ImprovementAnalysis.jsx` | ✅ Active |
| `/bhf/change-log` | `src/pages/bhf/ChangeLog.jsx` | ✅ Active |
| `/bhf/*` | (Various Doc Pages) | ✅ Active |

## 3. Disconnected / Orphaned Functionality
The following features exist in the codebase but are **not currently accessible** via the router in `App.jsx`. They were previously part of the `Crm.jsx` sub-router which has been bypassed.

| Feature | Original Component | Missing Route Path |
|---|---|---|
| **Unified Inbox** | `src/pages/crm/Inbox.jsx` | `/crm/inbox` |
| **Schedule** | `src/pages/crm/Schedule.jsx` | `/crm/schedule` |
| **Job Management** | `src/pages/crm/Jobs.jsx` | `/crm/jobs` |
| **Marketing Hub** | `src/pages/crm/Marketing.jsx` | `/crm/marketing` |
| **Partner Manager** | `src/pages/crm/Partners.jsx` | `/crm/partners` (Admin View) |
| **Estimates** | `src/pages/crm/Estimates.jsx` | `/crm/estimates` |
| **Pipeline** | `src/pages/crm/Pipeline.jsx` | `/crm/pipeline` |
| **Action Hub** | `src/pages/crm/ActionHub.jsx` | `/crm/action-hub` |

## 4. Route Guards & Auth
- **Implementation:** `src/components/AdminRoute.jsx`
- **Logic:** Wraps protected components. Checks `useSupabaseAuth()`. If `!user`, redirects to `/login`.
- **Coverage:** All `/crm/*` and `/bhf/*` routes are correctly wrapped.

## 5. Critical Issues
1.  **Lost Navigation:** Users cannot navigate to Inbox, Schedule, or Marketing tools because these routes are undefined in `App.jsx`.
2.  **Navigation Links:** The `EnterpriseSidebar` (if using default links) likely points to routes that do not exist in `App.jsx`, potentially causing 404s or dead clicks.
3.  **`Crm.jsx` Obsolescence:** `src/pages/crm/Crm.jsx` is currently dead code. It contains a `<Routes>` definition that is never rendered.

## 6. Recommendations
1.  **Migrate Orphaned Routes:** Manually import and add the missing CRM pages (`Inbox`, `Schedule`, `Marketing`, etc.) into `App.jsx`, wrapping them in `<AdminRoute>` and potentially the `EnterpriseLayout`.
2.  **Update Sidebar:** Ensure `src/components/crm/EnterpriseSidebar.jsx` navigation links match the routes defined in `App.jsx`.
3.  **Deprecate `Crm.jsx`:** Once all child routes are moved to `App.jsx`, delete `src/pages/crm/Crm.jsx` to avoid confusion.