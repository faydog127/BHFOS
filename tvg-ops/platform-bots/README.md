# TVG Platform Bots — Foundation

Status: **A0/A1 development only — NOT ACTIVE — NO LIVE ACCESS — NO EXTERNAL WRITES**.

This package provides a shared prepare-only framework for platform specialists serving TVG management seats. Platform bots are not managers and do not own business decisions.

Initial adapters:
- `TVG-HCP-BOT-001` — Housecall Pro job/appointment preparation for Dispatch, Customer Care, Service, and Finance.
- `TVG-LESSEN-BOT-001` — Lessen work-order preparation for Dispatch, Service, Finance, and Business Development.
- `TVG-LULA-BOT-001` — Lula work-order/go-back preparation for Dispatch, Service, Finance, and Business Development.
- `TVG-BHFOS-APP-BOT-001` — the production TVG CRM/internal operating surface at `app.bhfos.com`; prepares internal CRM operational records for the responsible TVG seats. It is not Network OS and does not acquire product authority by being hosted under BHFOS.
- `TVG-ZRS-BOT-001` — ZRS property/service-record preparation for Dispatch, Service, Finance, and Business Development. The exact upstream integration surface remains `UNKNOWN` until independently verified.

## Authority and source posture

- Housecall Pro remains an operational source where current TVG governance says it is authoritative; this adapter does not silently replace that authority with the BHFOS App.
- `app.bhfos.com` is the production TVG CRM/internal operating surface evidenced by the BHFOS repository. This adapter does not infer that every CRM module is the source of truth for every field.
- ZRS records are treated as channel/property-management data. No API, portal schema, or write capability is claimed by this package.
- Platform bots prepare normalized evidence for management seats; the receiving seat or OCC owns interpretation and decisions within its authority.

## Hard boundaries

- No authentication or credentials.
- No network calls.
- No live API/browser access.
- No customer/provider contact.
- No schedule, work-order, register, invoice, quote, account, or CRM mutation.
- Unknown upstream schemas stay unverified; field aliases here are synthetic normalization candidates, not claims about platform APIs.
- Missing values remain `UNKNOWN`.
- Output is always `PREPARED_NOT_DELIVERED` with `external_action: NONE` and writes/live access `BARRED`.

## Use

```js
import { hcpBot } from './src/index.mjs';
const handoff = hcpBot.handoff(syntheticRecord, {
  runTime: new Date().toISOString(),
  staleAfterMinutes: 30,
  recipient: 'DISPATCH',
});
```

Freshness thresholds are caller-supplied by the governing workflow. The platform adapter does not invent a TTL.
