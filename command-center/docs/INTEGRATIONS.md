# Integrations

## Environment variables

- Put non-secret config in `.env`.
- Put secrets in `.env.local` (preferred).

For PowerShell sessions (Supabase CLI, ad-hoc scripts), load env vars into the current shell:

```powershell
. .\scripts\Import-Env.ps1
```

## Supabase

### Frontend (Vite)

Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### CLI / admin scripts

Common:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`

Example (lists projects):

```powershell
. .\scripts\Import-Env.ps1
.\tools\supabase\supabase.exe projects list
```

## Hostinger

Required:

- `HOSTINGER_API_TOKEN` (or `API_TOKEN`)

Optional:

- `HOSTINGER_DOMAIN`
- `HOSTINGER_ARCHIVE`

Deploy a static archive:

```powershell
. .\scripts\Import-Env.ps1
node .\tmp\deploy-hostinger-static.mjs --dry-run
node .\tmp\deploy-hostinger-static.mjs --domain=app.bhfos.com --archive=.\tmp\dist-deploy-YYYYMMDD-HHMMSS.zip
```
