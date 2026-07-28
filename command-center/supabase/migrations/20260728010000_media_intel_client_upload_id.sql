-- Idempotent client upload identity for resumable / retry-safe minting.
-- Additive only; does not weaken RLS.

alter table public.mil_upload_grants
  add column if not exists client_upload_id text;

comment on column public.mil_upload_grants.client_upload_id is
  'Optional client-generated upload id. Unique per session when set so mint/retry can reuse the same grant path.';

create unique index if not exists mil_upload_grants_session_client_upload_uidx
  on public.mil_upload_grants (session_id, client_upload_id)
  where client_upload_id is not null
    and revoked_at is null
    and finalize_state in ('minted', 'placing', 'placed');
