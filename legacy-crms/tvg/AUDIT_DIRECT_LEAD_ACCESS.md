
# Audit Report: Direct Leads Table Access

**Date:** 2026-01-04
**Objective:** Identify remaining direct `supabase.from('leads')` calls bypassing the `lead-intake` Edge Function.

## 🚨 Critical Findings

### 1. `src/components/EstimateWizard.jsx` (High Priority)
- **Code:**
  