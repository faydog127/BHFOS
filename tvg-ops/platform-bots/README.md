# TVG Platform Bots — Foundation

Status: **A0/A1 development only — NOT ACTIVE — NO LIVE ACCESS — NO EXTERNAL WRITES**.

This package provides a shared prepare-only framework for platform specialists serving TVG management seats. Platform bots are not managers and do not own business decisions.

Initial adapters:
- `TVG-HCP-BOT-001` — Housecall Pro job/appointment preparation for Dispatch, Customer Care, Service, and Finance.
- `TVG-LESSEN-BOT-001` — Lessen work-order preparation for Dispatch, Service, Finance, and Business Development.
- `TVG-LULA-BOT-001` — Lula work-order/go-back preparation for Dispatch, Service, Finance, and Business Development.

## Hard boundaries

- No authentication or credentials.
- No network calls.
- No live API/browser access.
- No customer/provider contact.
- No schedule, work-order, register, invoice, or account mutation.
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
