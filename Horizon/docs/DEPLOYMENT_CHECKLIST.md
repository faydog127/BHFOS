
# BHF Deployment Checklist

## Environment Variables

Ensure the correct `VITE_TENANT_ID` is set during the build process for each host.

| Tenant | Hostname | VITE_TENANT_ID | Notes |
|--------|----------|----------------|-------|
| Factory | `blackhorse.vent-guys.com` | `default` | Full access, system diagnostics enabled |
| TVG | `crm.theventguys.com` | `tvg` | Standard production CRM |
| Install Worxs | `installworxs.vent-guys.com` | `installworxs` | Placeholder branding, full features |
| Black Horse Demo | `demo.vent-guys.com` | `demo` | Modern AI/Factory theme, demo landing page |

## DNS Configuration (Hostinger)

All CNAMEs must point to the deployment infrastructure (e.g., Vercel alias or Hostinger IP).

1. **Factory Host**: `blackhorse` CNAME -> `[Deployment Target]`
2. **Install Worxs**: `installworxs` CNAME -> `[Deployment Target]`
3. **Demo**: `demo` CNAME -> `[Deployment Target]`

## Tenant Specifics

### Install Worxs
- [ ] Verify placeholder logo loads.
- [ ] Verify primary color is neutral gray/slate.
- [ ] Confirm all CRM modules are accessible.

### Black Horse Demo
- [ ] Verify landing page at `/demo/home`.
- [ ] Check CRM theme: Should be dark mode with glassmorphism effects.
- [ ] Verify branding colors: Electric Cyan (`#06b6d4`) & Dark Slate (`#0f172a`).

## Feature Flags
Feature flags are managed in `src/config/bhf.config.json` but can be overridden via `system_settings` table in Supabase.

**Defaults:**
- `enableMarketing`: Enabled for all EXCEPT `tvg` (disabled in config) and `installworxs` (inherited enabled).
- `enableSettings`: Locked to TRUE in defaults, but `demo` tenant config may override if needed (currently inherits TRUE).

## Post-Deployment Verification
1. Visit `https://demo.vent-guys.com/demo/home` -> Should see AI Factory Landing Page.
2. Login to CRM on Demo -> Should see dark themed interface.
3. Visit `https://installworxs.vent-guys.com/bhf/crm` -> Should see standard light theme with Install Worxs branding.
