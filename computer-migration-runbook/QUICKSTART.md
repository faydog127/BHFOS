# Quick Start

## 1. Copy this package to the OLD PC.

## 2. Create migration folders on your external drive.

Dry run:

```powershell
pwsh -File scripts/migration/Create-Migration-Folders.ps1 -RootPath "E:\"
```

Apply:

```powershell
pwsh -File scripts/migration/Create-Migration-Folders.ps1 -RootPath "E:\" -Apply
```

## 3. Run the old PC audit.

```powershell
pwsh -NoProfile -File scripts/migration/Audit-OldPC.ps1 -OutputDir "E:\08_Backups\Migration_Audit_2026-05-11"
```

## 4. Fill in the templates.

- `docs/operations/computer-migration/templates/migration-log.csv`
- `docs/operations/computer-migration/templates/software-inventory.csv`
- `docs/operations/computer-migration/templates/accounts-inventory.csv`

## 5. Do not wipe the old PC until the README minimum safe standard is complete.
