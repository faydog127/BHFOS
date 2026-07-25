# Media Intelligence test fixtures

Placeholder files for future **public-safe transform** and derivative pipeline tests. These are **not** real JPEG binaries yet — replace each `.placeholder` with an actual test image before enabling transform tests.

## Required fixtures (replace placeholders)

| File | Purpose | Requirements |
|---|---|---|
| `exif-gps.jpg.placeholder` | GPS EXIF leakage test | JPEG with EXIF GPS tags; known lat/lon for assertion after strip |
| `orientation-6.jpg.placeholder` | Orientation normalization | JPEG with EXIF orientation tag (e.g. 6 = 90° CW); verify pixel orientation after re-encode |
| `xmp-iptc.jpg.placeholder` | XMP/IPTC metadata | JPEG with XMP or IPTC block outside minimal EXIF strip path |
| `malformed-truncated.jpg.placeholder` | Decode failure honesty | Truncated or corrupt JPEG; transform must fail closed (no partial promote) |
| `oversized-251mb.jpg.placeholder` | Size cap | File > 250 MB (or synthetic blob reference); must reject before hash/promote |

## Status

| Test area | Status |
|---|---|
| Fixture files on disk | **3 — scaffold only** (text placeholders) |
| Public-safe decode/re-encode transform | **5 — disabled pending safe implementation** (`media-intel-promote-website` returns 503) |
| Automated fixture-driven tests | **Disabled** — add under `tests/unit/` or edge integration only after transform exists |

## Usage (future)

When the public-safe pipeline is implemented and reviewed:

1. Replace `.placeholder` files with real binaries (keep out of git if large — use LFS or generate in CI).
2. Add tests that assert: GPS/orientation/XMP removed **after decode → re-encode**, not marker-only stripping.
3. Run transform tests in CI with Docker (not in browser) to avoid memory limits.

## Related

- Promote disabled: `supabase/functions/media-intel-promote-website/index.ts`
- Upload cap: `src/lib/mediaIntel/checksum.js` (`MAX_PRACTICAL_HASH_BYTES = 250 MB`)
- SQL contracts: `supabase/tests/mil/`
