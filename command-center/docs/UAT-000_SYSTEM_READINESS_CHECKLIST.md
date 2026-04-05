# UAT-000 System Readiness Checklist

## Purpose
Use this checklist before starting a UAT pass so results reflect real product behavior instead of setup noise.

## Environment Selection
- [ ] Environment selected and written down: `LOCAL-UAT` or `LIVE-UAT`
- [ ] Tenant confirmed: `tvg`
- [ ] Test account confirmed
- [ ] Current build or deploy identifier recorded
- [ ] If `LIVE-UAT`, testing is inspection-first and no direct code edits will be made on the server

## Device and Session Readiness
- [ ] Device recorded
- [ ] Browser/app mode recorded
- [ ] Battery above 80% for phone testing
- [ ] Stable network available for normal-path testing
- [ ] Separate plan exists for weak-signal or airplane-mode checks
- [ ] Previous session state cleared or intentionally preserved for the scenario
- [ ] Cache/session state noted before login tests

## Tools and Evidence
- [ ] Screenshots enabled
- [ ] Browser console ready if desktop/web testing is in scope
- [ ] Network tab ready if `LIVE-UAT` auth, asset, or payment tests are in scope
- [ ] Evidence folder or naming convention chosen for screenshots/videos

## Test Data Readiness
- [ ] Accepted quote exists for conversion testing
- [ ] Work order candidate has customer and service data
- [ ] Technician record exists for scheduling tests
- [ ] Invoice candidate is available or can be generated safely
- [ ] Public payment test plan is defined before using live billing rails
- [ ] No real customer records will be modified unless explicitly intended

## Execution Rules
- [ ] Defects will be logged with `Precondition`, `Steps`, `Expected`, `Actual`, `Severity`, `Environment`, and `Evidence`
- [ ] Defects will be tagged as `LOCAL-UAT` or `LIVE-UAT`
- [ ] Enhancements will not be logged as defects
- [ ] `Blocker`, `Major`, `Minor`, and `Enhancement` will be used consistently
- [ ] Live findings will be diagnosed on live, fixed in source, and redeployed cleanly

## Revenue Path Pass Order
- [ ] `UAT-001` Login
- [ ] `UAT-002` Quote accepted -> work order
- [ ] `UAT-003` Work order scheduling
- [ ] `UAT-004` Complete work order
- [ ] `UAT-004.5` Verify completed work order data before invoice generation
- [ ] `UAT-005` Create/send invoice
- [ ] `UAT-006` Public payment link

## Scope Guardrails
- [ ] Core revenue path is the first gate
- [ ] Near-term hardening after core pass: offline resilience, pricing/discount override logging
- [ ] Parked until revenue path is stable: safety pre-flight gate, follow-up seeding

## Start Decision
- [ ] Ready to begin pass
- Notes:

