# Comprehensive Schema Audit Report

**Date:** 2025-12-10  
**System:** Horizons Architecture Check  
**Status:** ⚠️ ISSUES DETECTED - ACTION REQUIRED

This document summarizes all schema irregularities, ambiguities, and missing constraints identified during the system audit.

## 1. Ambiguity Errors (Multiple Relationship Paths)
These relationships cause `PGRST201` (Ambiguous relationship) errors in Supabase/PostgREST when performing joins without explicit relationship hints.

### A. The "Invoice" Quadruple-Link
The `invoices` table has four separate foreign keys pointing to tables that also point to `leads`, plus a direct link to `leads` itself.
*   **Direct Path:** `invoices.lead_id` → `leads.id`
*   **Via Job:** `invoices.job_id` → `jobs.id` → `leads.id`
*   **Via Quote:** `invoices.quote_id` → `quotes.id` → `leads.id`
*   **Via Appointment:** `invoices.appointment_id` → `appointments.id` → `leads.id`
*   **Impact:** Attempting to query `invoices` with `leads` embedded (e.g., `supabase.from('invoices').select('*, leads(*)')`) will fail immediately.

### B. The "Job" Triple-Link
*   **Direct Path:** `jobs.lead_id` → `leads.id`
*   **Via Estimate:** `jobs.estimate_id` → `estimates.lead_id` (Indirect)
*   **Via Property:** `jobs.property_id` → `properties` (and `leads` also links to `properties`).

## 2. Missing Foreign Key Constraints
The following columns appear to act as relational keys but lack formal database constraints. This risks data integrity (orphaned records) and prevents automatic relationship detection by the API.

| Table | Column | Intended Target | Risk Level |
| :--- | :--- | :--- | :--- |
| `jobs` | `estimate_id` | `estimates.id` | 🔴 High |
| `jobs` | `technician_id` | `technicians.id` | 🔴 High |
| `leads` | `partner_id` | `partners.id` (or `partner_prospects.id`) | 🟠 Medium |
| `leads` | `referrer_id` | `leads.id` | 🟢 Low (Self-ref usually handled manually, but better with FK) |

## 3. Redundant Data Paths (Consistency Risks)
These structures store the same relationship data in multiple places, creating a risk that they might disagree (e.g., a Job is assigned to Property A, but the Lead for that Job is assigned to Property B).

### A. Account vs. Property Hierarchy
*   **Paths:**
    1.  `leads` → `account_id`
    2.  `leads` → `property_id` → `account_id`
*   **Risk:** If a Lead is moved to a new Property, the `account_id` on the Lead record might remain stale, pointing to the old Property's Account.

### B. Leads & Partners
*   **Columns:** `leads` has both `referring_partner_id` (FK) and `partner_id` (No FK).
*   **Risk:** It is unclear if `partner_id` is a duplicate of `referring_partner_id` or if it represents a different relationship (e.g., "Owned by Partner" vs "Referred by Partner").

## 4. Circular Dependencies (Logical)
While strictly enforced circular FKs were not found (which would prevent inserts), logical circular dependencies exist that complicate data management.

*   **Leads ↔ Estimates ↔ Jobs:**
    *   A Lead creates an Estimate.
    *   An Estimate converts to a Job.
    *   The Job links back to the Lead.
    *   *Issue:* If the Lead is deleted, cascading deletes must be very carefully managed to avoid leaving "ghost" Jobs or Estimates.

## 5. Schema Drift & Denormalization
*   **`leads.partner_name`**: This is a text column. If the Partner's name changes in the `partners` table, this column will be outdated.
*   **`leads.customer_name`**: Similar issue. Should be derived from `first_name` + `last_name` or a `contacts` relation.

## 6. Recommendations (Do Not Implement Yet)
1.  **Consolidate Relationships:** Decide if `invoices` truly needs direct links to `appointments` AND `quotes` AND `jobs` AND `leads`. Usually, linking to `jobs` (which links to the others) is sufficient.
2.  **Add Missing Constraints:** Add FKs for `jobs.estimate_id` and `jobs.technician_id`.
3.  **Remove Redundancy:** Drop `leads.account_id` and rely on `leads.property_id` → `properties.account_id`.
4.  **Clarify Partner Links:** Rename `partner_id` to something more specific (e.g., `assigned_partner_id`) or remove if duplicate.