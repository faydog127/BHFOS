# TIS → n8n Pilot Payload (v1)

## Goal
Run the first **TIS → n8n** pilot using only fields you already capture (or can add on a phone call) — no “future ideal state” fields.

## Hard rule (pilot)
Do **not** require any of the following for intake:

- outsourced provider / vendor
- outsourced scope details
- materials used / purchased items
- invoice / estimate metadata (can be attached as a document later)

If that information isn’t captured in your workflow yet, the pilot must not block on it.

## Transport
Payload is sent from TIS to n8n as JSON (webhook POST).

## Required fields (v1)
Only these fields are required for pilot v1:

- `mode`
- `property_address`
- `service_date`
- `notes`
- `before_photos` (must contain at least 1 item)

Everything else is optional and must not block intake.

```json
{
  "mode": "pilot_non_production",
  "property_address": "730 Scott Ave SW, Palm Bay, FL",
  "service_date": "2026-04-14",
  "notes": "Observed contamination on coil and blower. Documentation incomplete.",
  "before_photos": [
    { "url": "https://.../before-1.jpg", "label": "coil" }
  ],
  "after_photos": [],
  "documents": []
}
```

### Field definitions
- `mode` (string, required): must equal `pilot_non_production` (prevents accidental production usage).
- `property_address` (string, required): single-line address string (no placeholders).
- `service_date` (string, required): ISO date preferred (`YYYY-MM-DD`), but a parseable date string is acceptable.
- `notes` (string, required): technician notes; can be short.
- `before_photos` (object[], required): **must contain at least 1 item**.
- `after_photos` (object[], optional): can be empty if after photos aren’t available.
- `documents` (object[], optional): optional uploads (invoice pdf, estimate, work order, etc); can be empty.

### Photo/document object shape (v1)
For pilot speed + extensibility, use objects (not raw strings):

```json
{ "url": "https://...", "label": "coil", "captured_at": "2026-04-14T15:22:00Z" }
```

- `url` (string, required)
- `label` (string, optional): short tag like `coil`, `blower`, `duct`, `plenum`, etc.
- `captured_at` (string, optional): ISO datetime if available.

Document objects reuse the same shape (typically `label: "invoice"` / `label: "estimate"` / etc).

## Optional fields (allowed in v1)
- `job_id` (string, optional): TIS job id, CRM job id, or a pilot tag like `pilot-001`.
- `customer_name` (string, optional)
- `after_photos` (object[], optional)
- `documents` (object[], optional)

## Optional enrichment fields (later)
These are explicitly **out of scope** for v1 intake. If included, they must be optional and must not block processing:

```json
{
  "outsourced_scope": null,
  "outsourced_provider": null,
  "materials_used": []
}
```

## Inference expectations (pilot)
The downstream system should handle sparse intake safely:

- If `notes` mention another contractor, the report can reference that neutrally.
- If no contractor/provider is captured, the report must not invent one.
- If materials are not captured, the report must not depend on them.
