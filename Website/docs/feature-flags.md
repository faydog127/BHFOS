# Feature Flags

BHF defaults have highest priority; tenants can only override where BHF allows. When a flag is off: hide from nav and 403/redirect the route.

## Flags (granular CRM)
- enableLeads
- enablePipeline
- enableJobs
- enableSchedule
- enableEstimates
- enableInvoicing
- enableContacts
- enableCallConsole
- enableSMS
- enableMarketing
- enableReporting
- enablePricebook
- enablePartners
- enableSettings
- enableTVG (example tenant-specific)

## Defaults
- Defined in `brand.config.json` under the `default` tenant; merged with per-tenant settings via `featureFlags.js`.
- BHF false wins; tenant cannot enable if BHF set to false.

## Usage
- Check `FEATURES` from `featureFlags.js` to decide nav and route guards.
- Document any per-tenant overrides here as needed.
