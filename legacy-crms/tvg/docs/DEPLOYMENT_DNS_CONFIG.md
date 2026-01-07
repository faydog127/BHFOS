# BHF Deployment & DNS Configuration

This document outlines the multi-tenant deployment strategy for the Black Horse Factory (BHF) environment.

## 1. Tenant ID Configuration

The application behavior is controlled by the `VITE_TENANT_ID` environment variable at build time (or runtime if serving appropriately).

| Hostname | VITE_TENANT_ID | Description |
|----------|---------------|-------------|
| `blackhorse.vent-guys.com` | `default` | **Factory Host**. Full system access, diagnostics, and BHF master controls enabled. |
| `crm.vent-guys.com` | `tvg` | **Production Tenant**. Standard CRM modules, branded for TVG. |
| `portal.installworxs.com` | `installworxs` | **Partner Tenant**. Limited features (No marketing/partners modules). |
| `demo.vent-guys.com` | `demo` | **Sales Sandbox**. Settings module locked. |

## 2. Config Priority Model

We utilize a "BHF First" priority model for feature flag resolution. This ensures system stability and prevents tenants from enabling unfinished or unstable features.

**Resolution Logic:**
`Final_Status = (BHF_Default === FALSE) ? FALSE : (Tenant_Override ?? BHF_Default)`

1.  **BHF Hard Stop**: If `bhf_defaults` has a feature set to `false`, it is **DISABLED** for all tenants. No override possible.
2.  **BHF Locked**: If `bhf_defaults` has `locked: true`, the BHF value is enforced strictly.
3.  **Tenant Override**: If BHF permits (Value=True, Locked=False), the tenant configuration in `brand.config.json` (or database override) takes precedence.

## 3. DNS Configuration (Hostinger / Cloudflare)

### Factory Host
*   **Type**: CNAME
*   **Name**: `blackhorse`
*   **Target**: `[Your-Vercel-Or-Hostinger-Endpoint]` (e.g., `connect.vercel-dns.com` or Hostinger IP)
*   **TTL**: Auto / 3600

### Tenant Hosts
Tenants should point their CNAME records to the same deployment infrastructure. The deployment pipeline must inject the correct `VITE_TENANT_ID` env var for that specific build/deployment.

## 4. Rollout Checklist

- [ ] **Verify `bhf.config.json`**: Ensure all tenant definitions exist and IDs match env vars.
- [ ] **Build Factory**: Deploy with `VITE_TENANT_ID=default`. Verify `/bhf/master-diagnostics` is accessible.
- [ ] **Build Tenant (TVG)**: Deploy with `VITE_TENANT_ID=tvg`. Verify `/bhf/master-diagnostics` is **HIDDEN**.
- [ ] **Check Flag Priority**:
    - Temporarily set `enableMarketing: false` in `bhf_defaults`.
    - Verify `tvg` tenant cannot access Marketing even if they try to enable it.
- [ ] **Verify Database**: Ensure `system_settings` table exists for runtime overrides using keys `feature_flags_default`, `feature_flags_tvg`, etc.
