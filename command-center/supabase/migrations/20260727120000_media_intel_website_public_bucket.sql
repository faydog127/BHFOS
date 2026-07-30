-- Media Intelligence Library — ensure website-public-media bucket exists.
-- Additive / idempotent. Does NOT enable promote (still 503 not_implemented).
-- Unpublish deletes via service_role admin client; authenticated clients must not write.
--
-- Conflict policy: insert if missing with reasonable MIL-aligned limits; if the bucket
-- already exists (e.g. marketing site provisioned it), only force public=true and leave
-- size/mime settings untouched so we do not break an existing deployment.

-- ---------------------------------------------------------------------------
-- Bucket: website-public-media (public read — publication end only)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'website-public-media',
      'website-public-media',
      true,
      262144000, -- 250 MiB (matches MIL originals/derivatives defense-in-depth)
      array[
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/quicktime', 'video/webm'
      ]
    )
    on conflict (id) do update set
      public = true;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage policies: public SELECT; writes/deletes service_role only
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  drop policy if exists "Website public media readable by anon" on storage.objects;
  drop policy if exists "Website public media readable by authenticated" on storage.objects;
  drop policy if exists "Website public media public read" on storage.objects;
  drop policy if exists "Website public media service role" on storage.objects;

  -- Public website CDN/read path: anon + authenticated SELECT only.
  create policy "Website public media public read"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'website-public-media');

  -- Promote (future) and unpublish remove use service_role; no authenticated INSERT.
  create policy "Website public media service role"
    on storage.objects for all to service_role
    using (bucket_id = 'website-public-media')
    with check (bucket_id = 'website-public-media');
end $$;
