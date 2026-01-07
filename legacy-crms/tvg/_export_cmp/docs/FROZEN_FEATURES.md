# Frozen Features Manifest (v2.5.0)

**Freeze Date:** 2025-12-16
**Status:** LOCKED
**Codename:** Horizon

This document lists all features that are considered "Feature Complete" and "Frozen" for the v2.5.0 release. No new functionality should be added to these modules without a formal Change Request (CR) and version bump.

## 1. Core CRM Module
| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Lead Management** | 🟢 **FROZEN** | Full CRUD, Pipeline stages, Drag-and-drop Kanban. |
| **Customer Accounts** | 🟢 **FROZEN** | Residential & Commercial account types differentiation. |
| **Estimates** | 🟢 **FROZEN** | Multi-option estimates, PDF generation logic. |
| **Invoicing** | 🟢 **FROZEN** | Stripe integration placeholders, QB sync hooks. |
| **Job Scheduling** | 🟢 **FROZEN** | Calendar view, Technician assignment. |

## 2. Smart Call Console
| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Call Hunter** | 🟢 **FROZEN** | Google Maps integration, Street View, Prop info. |
| **Script Engine** | 🟢 **FROZEN** | Dynamic script generation based on persona. |
| **Call Logging** | 🟢 **FROZEN** | Outcome tracking, Sentiment analysis fields. |
| **Quick Actions** | 🟢 **FROZEN** | "Book Now", "Send Quote", "Callback" workflows. |

## 3. Marketing Engine
| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Campaign Manager** | 🟢 **FROZEN** | Email/SMS campaign creation and scheduling. |
| **Automated Playbooks** | 🟢 **FROZEN** | Trigger-based workflows (e.g., "New Lead" -> "Welcome Email"). |
| **Analytics Dashboard** | 🟢 **FROZEN** | Open rate, Click rate, Conversion tracking. |
| **Template Editor** | 🟢 **FROZEN** | Variable substitution, basic HTML editor. |

## 4. Partner Portal & BHF
| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Partner Registration** | 🟢 **FROZEN** | Public-facing onboarding wizard. |
| **Partner Dashboard** | 🟢 **FROZEN** | Referral tracking, Commission calculation views. |
| **Tenant Management** | 🟢 **FROZEN** | BHF Admin view for multi-tenant switching. |
| **Tenant Onboarding** | 🟢 **FROZEN** | Wizard for provisioning new franchise instances. |

## 5. System Architecture
| Feature | Status | Notes |
| :--- | :--- | :--- |
| **System Doctor** | 🟢 **FROZEN** | Automated diagnostics, Schema drift detection. |
| **Rollback Manager** | 🟢 **FROZEN** | Inverse SQL generation, Safety windows. |
| **Audit Logs** | 🟢 **FROZEN** | Comprehensive action tracking. |
| **Training Mode** | 🟢 **FROZEN** | Data isolation sandbox, UI banners. |

---

## Areas Still in Active R&D (Not Frozen)
*The following areas are present in the codebase but are **NOT** covered by the v2.5.0 stability guarantee.*

1.  **AI Voice Agents (Klaire)**: Experimental integration only.
2.  **QuickBooks 2-Way Sync**: One-way sync is frozen; 2-way is experimental.
3.  **Mobile Native App**: Not included in this web deployment.