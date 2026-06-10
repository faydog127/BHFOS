# Computer Migration (Old PC → New PC) Runbook

Objective: move everything important from the old computer to the new one without losing business files, accounts/passwords, browser data, email access, licenses, AI project files, financial/tax records, marketing assets, automation systems, or local app settings.

This runbook is written for a **Windows** migration (PowerShell available).

---

## Minimum safe standard (do not skip)

- [ ] External backup completed (copy of “must not lose” data)
- [ ] Cloud backup verified (you can open files from the cloud on the new PC)
- [ ] Passwords + MFA recovery codes exported/saved securely
- [ ] Business assets verified (open key files on new PC)
- [ ] Photos/videos verified (open random samples on new PC)
- [ ] Browser sync verified (bookmarks + passwords show up on new PC)
- [ ] Software/license keys saved
- [ ] Financial/tax documents checked
- [ ] Email fully functional on the new PC
- [ ] Old PC not wiped for **2–4 weeks** after success

---

## Templates (use these to track the move)

- `docs/operations/computer-migration/templates/migration-log.csv`
- `docs/operations/computer-migration/templates/software-inventory.csv`
- `docs/operations/computer-migration/templates/accounts-inventory.csv`

---

## Phase 1 — Stabilize and audit the old computer

### 1) Stop creating random storage locations

- [ ] Stop saving files to random folders
- [ ] Centralize important business files
- [ ] Reduce obvious duplicates/junk (don’t over-optimize)

Create these top-level folders (choose one root location you’ll remember, e.g., your main user folder or a dedicated `Business` folder):

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

Optional helper (safe): `scripts/migration/Create-Migration-Folders.ps1`

---

## Phase 2 — Inventory everything critical (“must not lose”)

### Business / Operations

- [ ] The Vent Guys assets (logos, decks, scripts, photo/video, SEO docs, prompt libraries)
- [ ] KAQI files (logic bible, JSON, workflows, audit forms, scoring logic, UI mockups, prompt chains)
- [ ] Contracts, estimates, SOPs, brand assets
- [ ] HouseCall Pro exports / client spreadsheets / pricing sheets / calendars
- [ ] IAQ documentation / certification documents

### Accounts (confirm you can log in)

- [ ] Gmail / Google Drive
- [ ] Adobe / Canva
- [ ] ChatGPT / OpenAI
- [ ] Banking
- [ ] Domain registrar / hosting
- [ ] Social media
- [ ] CRM access

### Development / AI

- [ ] Prompt libraries
- [ ] GPT exports (if applicable)
- [ ] Automation files (n8n workflows, scripts)
- [ ] API keys + where they are stored (do not paste keys into logs/docs)

### Personal

- [ ] Photos/videos
- [ ] Tax documents
- [ ] IDs / insurance / school / VA records

---

## Phase 3 — Backup strategy (3-2-1 rule)

You want:
- 3 copies of important data
- 2 different storage types
- 1 offsite/cloud copy

Recommended:
- Copy #1: Old computer (unchanged until fully verified)
- Copy #2: External SSD (preferred) or HDD
- Copy #3: Cloud storage (Google Drive / OneDrive / Dropbox / iCloud)

---

## Phase 4 — Export critical systems (browser)

### Chrome / Edge / Firefox

- [ ] Sync is ON (passwords, bookmarks, extensions, history, autofill)
- [ ] Manual exports completed

Passwords:
- Settings → Password Manager → Export Passwords
- Save to: `09_Installers_Licenses/Passwords_Backup.csv`

Bookmarks:
- Bookmark Manager → Export Bookmarks
- Save to: `09_Installers_Licenses/Bookmarks_Backup.html`

Security note: treat exported password files as extremely sensitive. Store them on the external SSD and remove them from the desktop/downloads when done.

---

## Phase 5 — Save software and license information

- [ ] Fill out `software-inventory.csv`
- [ ] Save installers when possible
- [ ] Save activation keys
- [ ] Save MFA recovery codes (and where they are stored)

---

## Phase 6 — Full file transfer

Copy these folders (and verify they open on the new PC):

- [ ] Desktop
- [ ] Documents
- [ ] Downloads (common “forgotten” location)
- [ ] Pictures
- [ ] Videos
- [ ] Music

Also check:
- [ ] `AppData` (some apps store critical data locally)
- [ ] Local project folders (common: `C:\\BHFOS`, `C:\\Users\\<you>\\source`, `C:\\Users\\<you>\\projects`)
- [ ] OBS recordings / Adobe exports / random exports folders

---

## Phase 7 — Business-specific preservation (verification, not just copying)

- [ ] Open 3–5 key business files on the new PC (Adobe, Canva exports, docs, spreadsheets)
- [ ] Confirm photos/videos open and are complete (pick random samples)
- [ ] Confirm critical automations can be found (n8n exports, scripts, configs)

---

## Phase 8 — Create clean folder architecture on the new PC

Do not dump everything randomly. Suggested structure:

```text
Business/
    The Vent Guys/
    KAQI/
    Marketing/
    Finance/
    SOPs/

Personal/
    Photos/
    Family/
    School/

Systems/
    Installers/
    Drivers/
    Backups/
```

---

## Phase 9 — New computer setup order

1) [ ] Update Windows fully
2) [ ] Install browser
3) [ ] Log into password manager / browser sync
4) [ ] Install security software
5) [ ] Install cloud sync apps
6) [ ] Install critical business apps (Adobe, Office, Canva, ChatGPT, HCP, Google Drive)
7) [ ] Move business folders
8) [ ] Reconnect printers/scanners
9) [ ] Test email, sync, bookmarks, passwords, external drives, audio/video

---

## Phase 10 — Verification pass (before wiping old PC)

Do not erase the old computer until:

- [ ] All critical files transferred
- [ ] Passwords work
- [ ] Email works
- [ ] Browser sync works
- [ ] Financial records accessible
- [ ] Cloud sync complete
- [ ] Photos visible
- [ ] Business files open correctly
- [ ] AI projects intact

Hold the old machine untouched for **2–4 weeks** after the new PC is stable.

---

## Optional: run a non-destructive audit on the old PC

This repo includes a safe PowerShell script that generates CSV/JSON reports (installed apps list, drives, browser profiles, cloud folders, key folder checks).

Script:
- `scripts/migration/Audit-OldPC.ps1`

Example:

```powershell
pwsh -File scripts/migration/Audit-OldPC.ps1 -OutputDir "E:\\08_Backups\\Migration_Audit_2026-05-11"
```

If `installed-apps.csv` is mostly empty (common when apps were installed via Microsoft Store), also check:
- `store-apps-current-user.csv` (and optionally `store-apps-all-users.csv` if you ran with `-IncludeAllUsersStoreApps`)
- `winget-export.json` or `winget-list.txt` (if `winget` is available)
