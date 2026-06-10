# Computer Migration Runbook — Windows

## Objective

Safely package, audit, back up, transfer, and verify everything from the old PC before moving to the new PC.

This runbook is designed to prevent the common migration failures:

- Lost passwords
- Missing business files
- Broken browser sync
- Forgotten Downloads/Desktop files
- Missing software licenses
- Incomplete cloud sync
- Wiping the old PC too early

---

## Minimum Safe Standard

Do **not** wipe, sell, reset, or retire the old computer until all items below are complete.

- [ ] External backup completed
- [ ] Cloud backup completed
- [ ] Browser sync confirmed
- [ ] Password export saved securely
- [ ] Bookmarks exported
- [ ] Business files verified on new PC
- [ ] Photos/videos verified on new PC
- [ ] Financial/tax records verified
- [ ] Email works on new PC
- [ ] Critical apps installed and signed in
- [ ] Software licenses documented
- [ ] MFA/recovery codes verified
- [ ] Old PC retained untouched for 2–4 weeks

---

## Recommended Folder Structure

Create this structure on your external drive or migration staging folder:

```text
01_Business
02_Personal
03_Financial
04_Photos_Video
05_AI_Projects
06_Marketing
07_Legal_Admin
08_Backups
09_Installers_Licenses
```

Use `scripts/migration/Create-Migration-Folders.ps1` to generate these folders safely.

Dry run:

```powershell
pwsh -File scripts/migration/Create-Migration-Folders.ps1 -RootPath "E:\"
```

Actually create folders:

```powershell
pwsh -File scripts/migration/Create-Migration-Folders.ps1 -RootPath "E:\" -Apply
```

---

## Phase 1 — Audit the Old PC

Run the audit script from the old PC.

Recommended:

```powershell
pwsh -NoProfile -File scripts/migration/Audit-OldPC.ps1 -OutputDir "E:\08_Backups\Migration_Audit_2026-05-11"
```

Optional slower folder-size scan:

```powershell
pwsh -NoProfile -File scripts/migration/Audit-OldPC.ps1 -OutputDir "E:\08_Backups\Migration_Audit_2026-05-11" -ComputeSizes
```

The audit creates:

- `summary.json`
- `installed-apps.csv`
- `user-folders.csv`
- `browser-paths.csv`
- `cloud-folders.csv`
- `environment.json`

---

## Phase 2 — Browser and Password Backup

### Chrome / Edge

- [ ] Confirm sync is on
- [ ] Export bookmarks
- [ ] Export passwords if needed
- [ ] Confirm extensions are documented

Save exports to:

```text
09_Installers_Licenses
```

Recommended filenames:

```text
browser-bookmarks.html
passwords-export.csv
```

Important: password CSV files are sensitive. Store securely and delete unsecured copies after migration.

---

## Phase 3 — Business File Backup

Prioritize business-critical folders first.

- [ ] The Vent Guys
- [ ] KAQI
- [ ] Marketing assets
- [ ] Canva/Adobe exports
- [ ] Presentations
- [ ] Estimates
- [ ] SOPs
- [ ] IAQ documentation
- [ ] Customer/project records
- [ ] Financial records
- [ ] Tax records

Track each folder in:

```text
templates/migration-log.csv
```

---

## Phase 4 — Software and License Tracking

Fill out:

```text
templates/software-inventory.csv
```

Track:

- Software name
- Login email
- License key
- Subscription status
- Download link
- Install status on new PC
- Notes

---

## Phase 5 — Account Tracking

Fill out:

```text
templates/accounts-inventory.csv
```

Track:

- Account/platform
- Login email
- MFA status
- Recovery codes saved
- New PC login confirmed
- Notes

Do not store plain-text passwords in this file.

---

## Phase 6 — New PC Setup Order

Recommended order:

1. Update Windows
2. Install preferred browser
3. Sign into browser/password manager
4. Install cloud storage apps
5. Install Microsoft Office / Adobe / Canva / business tools
6. Copy critical business files first
7. Copy personal/photos/videos
8. Reconnect printers/scanners
9. Verify email, cloud sync, and file access
10. Install remaining software

---

## Phase 7 — Verification

Before considering the migration complete:

- [ ] Open several random files from each migrated folder
- [ ] Open business presentations
- [ ] Open Adobe/Canva exports
- [ ] Confirm photos/videos display correctly
- [ ] Confirm cloud sync is complete
- [ ] Confirm email works
- [ ] Confirm passwords/autofill work
- [ ] Confirm MFA works
- [ ] Confirm external drive backup still exists
- [ ] Keep old PC untouched for 2–4 weeks

---

## Known Risks

### Audit script with `-ComputeSizes`
This can be slow on large folders.

### Installed apps report
Some apps may not appear because not all Windows apps register in the same place.

### Cloud sync
Do not assume cloud sync is finished just because folders appear. Confirm sync status.

### Downloads folder
This is usually where forgotten important files live. Review manually.

---

## Final Closeout

Migration is complete only when:

- [ ] New PC can operate independently
- [ ] All critical files are verified
- [ ] All major accounts are accessible
- [ ] Backups exist in at least two places
- [ ] Old PC has been retained long enough to catch missing items
