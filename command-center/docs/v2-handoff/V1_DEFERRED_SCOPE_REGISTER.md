# V1 Deferred Scope Register

These items are **out of V1 required scope** unless a Founder Major Decision re-opens them. Do **not** treat as V1 defects solely because they are absent.

| Item | Status | Authority / source | Notes for V2 |
| --- | --- | --- | --- |
| Slice 7 | Deferred — do not start | ML-P1 state ledgers | Separate program |
| Auto-charge | Disabled by policy | PD-S6-02; auth interrupt | Major Decision to enable |
| Saved cards / vault | Disabled / not built | PD-S6-03 | Major Decision |
| Stripe Customer Portal | Disabled | PD-S6-06 | Major Decision |
| Stripe Terminal | Disabled | PD-S6-06 | Major Decision |
| Photo Bundles | Deferred / not started | S8 residual R-S8-BUNDLE-01 | Product slice |
| Full media library | Deferred | S8 / UX residuals | Beyond evidence photos |
| Complete PWA | Deferred (UX-PWA unauthorized) | UX-POLISH / UXV2 | Install + SW |
| Full offline field application | Deferred | S8 cache is baseline only | Beyond 250MB cache |
| Commercial Account Manager | Deferred | Not in ML-P1 closed slices | New product |
| Advanced analytics | Deferred / thin now | R-S8-ANALYTICS-01 | Expand carefully |
| QuickBooks expansion | Deferred | PD-S6-07; R-UXP-03 audit | Ops first |
| AI / voice agent operations | Deferred | Partial inspection AI ≠ voice ops | Separate |
| Shared multi-tenant SaaS | Excluded | Dedicated deployment architecture | Do not silently reopen |
| Native iOS / Android rewrite | Deferred | Web/PWA path only | Separate |
| Admin write-off RPC/UI | Deferred residual | R-S5-08 | May enter V2 as residual close |
| Visual CI farm (Percy at scale) | Scaffold only | UXV2 | Needs `PERCY_TOKEN` + process |
| Cypress farm | Prefer Playwright | UXV2 PD default | Tooling choice |

## Halt defaults (carry forward)

Auto-send · auto-charge · portal/vault · Terminal · TIS merge · Photo Bundles · S7 · Hostinger without Access Matrix **S** · production mutations on synthetic validation without `sk_test` discipline.
