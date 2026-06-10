# RLS / Public Surface Boundary Checks (v1)

Purpose: ensure public endpoints behave like **scoped views**, not “anonymous APIs”.

## Required checks

### Token non-enumerability
- Invalid token does not reveal invoice existence beyond a generic 404/denied response.
- Valid token returns only the scoped invoice/quote.

### No anon enumeration
- Anon/public cannot list invoices/jobs/contacts/leads.

### Webhook signature enforcement
- Unsigned webhook requests fail (400/401) in PROD-like mode.
- LOCAL may allow a test bypass only when:
  - request is local, AND
  - explicit test mode is enabled, AND
  - caller supplies a dedicated test header.

### Mutation containment
- Public-pay cannot mutate arbitrary invoices without a valid token bound to the invoice.

