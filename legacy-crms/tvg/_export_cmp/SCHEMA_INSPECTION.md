# Database Schema Inspection (2025-11-25)

## 1. Table: `marketing_actions`
**Status:** ✅ Exists
**Columns (Type):**
- `id` (uuid, NOT NULL)
- `lead_id` (uuid, Foreign Key to `leads`)
- `playbook_key` (text, NOT NULL)
- `type` (text, NOT NULL)
- `channel` (text, NOT NULL)
- `status` (text)
- `content_preview` (text)
- `target_details` (jsonb)
- `scheduled_at` (timestamp with time zone)
- `created_at` (timestamp with time zone)
- `approved_at` (timestamp with time zone)
- `approved_by` (uuid)
- `sent_at` (timestamp with time zone)
- `error_log` (text)
- `reviewer_notes` (text)
- `reviewed_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `reviewed_by` (text)

## 2. Table: `marketing_content`
**Status:** ❌ **DOES NOT EXIST**
*Note: All content data currently resides in the `marketing_actions` table under the `content_preview` column or `target_details` JSONB column.*

## 3. Function: `trigger_marketing_playbooks`
**Status:** ✅ Active
**Language:** plpgsql
**Current Definition:**