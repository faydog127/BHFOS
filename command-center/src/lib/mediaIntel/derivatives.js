/**
 * Pre-staging hardening: library staff no longer have an INSERT policy on
 * mil_derivatives, and storage writes to mil/derivatives/% are reserved for the
 * trusted server-side worker (staff sessions may only write mil/quarantine/%).
 * Rather than write to a forbidden path (which would fail RLS/storage policy
 * anyway) or silently redirect thumbnails into mil/quarantine/derivatives/ where
 * nothing would ever consume them, this client helper now soft-fails: it warns
 * and returns null so callers keep working without a client-generated thumbnail.
 * Grid thumbnails are produced by the server-side processing worker after
 * checksum verification/finalize.
 */
export async function createImageGridThumb() {
  console.warn(
    'MIL: client-side derivative write skipped (mil_derivatives has no client INSERT ' +
      'policy under pre-staging hardening). Thumbnail generation is deferred to the ' +
      'server-side processing worker.',
  );
  return null;
}
