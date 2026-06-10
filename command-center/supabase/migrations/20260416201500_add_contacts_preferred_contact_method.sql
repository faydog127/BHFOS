-- Add contact-level delivery preference used by CRM selects.
-- Canonical schema lives in supabase/migrations/.
-- This is additive + idempotent.

alter table if exists public.contacts
  add column if not exists preferred_contact_method text;
