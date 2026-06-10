param(
  [string]$SourcePath = "docs/document-library/_incoming/claude-session-2026-04-10/00_Master_Document_Library_Map.md",
  [string]$DestPath = "docs/document-library/locked/00_Master_Document_Library_Map_v0.4.md"
)

$ErrorActionPreference = "Stop"

function Assert-OneMatch([string]$text, [string]$pattern, [string]$label) {
  $rx = [regex]::new(
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  $count = $rx.Matches($text).Count
  if ($count -ne 1) {
    throw "Expected exactly 1 match for '$label' but found $count."
  }
}

function Replace-One([string]$text, [string]$pattern, $replacement, [string]$label) {
  Assert-OneMatch -text $text -pattern $pattern -label $label
  $rx = [regex]::new(
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  if ($replacement -is [scriptblock]) {
    $evaluator = [System.Text.RegularExpressions.MatchEvaluator]$replacement
    return $rx.Replace($text, $evaluator, 1)
  }
  return $rx.Replace($text, [string]$replacement, 1)
}

function Insert-Before([string]$text, [string]$needlePattern, [string]$insertBlock, [string]$label) {
  Assert-OneMatch -text $text -pattern $needlePattern -label $label
  $rx = [regex]::new(
    $needlePattern,
    [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::Multiline
  )
  $m = $rx.Match($text)
  return $text.Substring(0, $m.Index) + $insertBlock + $text.Substring($m.Index)
}

function Update-MasterTable([string]$content) {
  $startMarker = "| Doc ID | Name | Cat | Purpose | Owner | Primary Audience | Data Dependencies | Complexity | Status |"
  $endMarker = "**Total V1 documents tracked: 29**"

  $startIdx = $content.IndexOf($startMarker)
  if ($startIdx -lt 0) { throw "Could not find master table header line." }

  $endIdx = $content.IndexOf($endMarker, $startIdx)
  if ($endIdx -lt 0) { throw "Could not find master table end marker." }

  $before = $content.Substring(0, $startIdx)
  $tableAndAfter = $content.Substring($startIdx, $endIdx - $startIdx)
  $after = $content.Substring($endIdx)

  $lines = $tableAndAfter -split "\r?\n"

  $newHeader = "| Doc ID | Name | Cat | Purpose | Owner | Primary Audience | Data Dependencies | Complexity | Tombstone Class | Status |"
  $newSep = "|--------|------|-----|---------|-------|-----------------|-------------------|------------|----------------|--------|"

  $purpose00b =
    'Defines the system''s end-to-end behavior as one coherent narrative. Covers: full lifecycle walkthrough; object mutation rules; lock points A–G; render trigger rules; pricing freeze behavior; artifact revocation and tombstoning by class (I/II/III) including `pending_supersession` state and reopen interaction; authority-class split for field/office conflicts (Class A / Class B / five differentiated Hard-Stop flags); sweep-to-context capture behavior with evidence class split and immutable promotion model; session-local reconciliation clock with archive gate enforcement; Tier 2 correction boundaries with system-enforced tier validation; runtime conflict resolution with named governing documents; downstream revalidation rules.'

  $purpose03 =
    'Defines all system entities and field-level schemas. Includes runtime entities plus the Asset/Zone containment hierarchy (Property → Structure → Zone → System → Equipment) so findings can be bound to distinct assets; includes `evidence_class` (`context` | `finding`) on Evidence for render/QA rules. See Section B.1 for the full entity list and containment model.'

  $append04b =
    ' **State Enforcement Matrix requirements from `00b` v1.2:** (1) Five Hard-Stop flag fields confirmed as read-only in all states — no write path from TIS; (2) Evidence entity includes `evidence_class` attribute (`context` | `finding`) as a state-tracked property; (3) `archived` state transition gate includes Class A field reconciliation as a required precondition — this is a state machine constraint, not a UI validation; (4) `pending_supersession` artifact status is a valid state-trackable event; (5) Full-offline sync: hard-stop check is the first operation on connectivity resume before any session data commits; (6) Explicit Correction/Revision state or transition path exists for Tier 2 corrections post-`presented` without allowing silent mutation.'

  $tombstoneByDocId = @{
    "11a" = "Class I"
    "11b" = "Class II → Class III"
    "11c" = "Class I"
    "11d" = "Class I (default; regulated-context escalation path to Class II)"
    "11e" = "Class II"
    "11f" = "Class III"
    "11g" = "Class I"
    "11h" = "Class I"
  }

  $outLines = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line -eq $startMarker) {
      $outLines.Add($newHeader)
      continue
    }
    if ($line -match '^\|[- ]+\|[- ]+\|') {
      $outLines.Add($newSep)
      continue
    }
    if (-not ($line.StartsWith("|") -and $line.EndsWith("|"))) {
      $outLines.Add($line)
      continue
    }

    $cells = $line.Split("|")
    if ($cells.Length -lt 5) {
      $outLines.Add($line)
      continue
    }

    $trimmed = $cells | ForEach-Object { $_.Trim() }
    $trimmed = $trimmed[1..($trimmed.Length - 2)]

    if ($trimmed.Length -ne 9) {
      $outLines.Add($line)
      continue
    }

    $docId = ($trimmed[0] -replace '\*', '').Trim()
    if ($docId.StartsWith("**") -and $docId.EndsWith("**")) {
      $docId = $docId.Trim("*").Trim()
    }

    if ($docId -eq "00") {
      $trimmed[8] = "✅ Locked"
    }

    if ($docId -eq "00b") {
      $trimmed[3] = $purpose00b
      $trimmed[8] = "✅ Locked"
    }

    if ($docId -eq "03") {
      $trimmed[3] = $purpose03
    }

    if ($docId -eq "04b") {
      $trimmed[3] = $trimmed[3] + $append04b
      $trimmed[6] = '`03`, `00b`'
    }

    if ($docId -eq "09") {
      if ($trimmed[6] -notmatch '`00b`') {
        $trimmed[6] = $trimmed[6] + ', `00b`'
      }
    }

    $tombstoneClass = "—"
    if ($tombstoneByDocId.ContainsKey($docId)) {
      $tombstoneClass = $tombstoneByDocId[$docId]
    }

    $newCells = @(
      $trimmed[0], $trimmed[1], $trimmed[2], $trimmed[3], $trimmed[4],
      $trimmed[5], $trimmed[6], $trimmed[7], $tombstoneClass, $trimmed[8]
    )
    $outLines.Add("| " + ($newCells -join " | ") + " |")
  }

  return $before + ($outLines -join "`r`n") + "`r`n" + $after
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "SourcePath not found: $SourcePath"
}

$content = Get-Content -LiteralPath $SourcePath -Raw

$content = Replace-One -text $content -pattern "\*\*Status:\*\* Pre-Build Draft v0\.3" -replacement "**Status:** ✅ Locked v0.4" -label "Status line"

$content = Replace-One `
  -text $content `
  -pattern "(\| v0\.3 \| 2026-04-10 \| Lead Architect \| Operator-level critique applied\..*?\|`r?`n)" `
  -replacement ('${1}| v0.4 | 2026-04-10 | Lead Architect | Applied `00b` v1.2 inserts. Updated `03` with full Asset/Zone entity hierarchy + 3 new runtime objects + `evidence_class` attribute. Added `04b` dependency on `00b`. Updated `09` upstream to include `00b`. Assigned tombstone classes to all `11a–11h`. Updated gate conditions for `04b`, `04`, `07`, `09`, `04c`. Added 6 V-series critique items to Section A. |' + "`r`n") `
  -label "Changelog v0.4 row insert"

$newCritique = @'

### v0.3 → v0.4: Post-Operator Critique — 6 Items

> **Resolved in this version (v0.4).**

| # | Severity | Issue | Disposition |
|---|----------|-------|-------------|
| V-01 | High | Artifact revocation / tombstoning absent. Superseded artifacts had no distribution enforcement. | Added `00b` Sections 9b.1–9b.5. Three artifact classes defined (Class I/II/III). `pending_supersession` state added. Delivery channel tracking requirement stated. Reopen-tombstone interaction defined. |
| V-02 | High | Status-level office authority undifferentiated. All hard-stop flags treated identically. | Replaced `00b` Section 3.6. Five hard-stop flags with differentiated continuation rules. `do_not_service` and `unsafe_entry_restriction` stop all activity; `payment_legal_hold` and `no_contracting_authority` block only new contracting. |
| V-03 | High | Sweep-to-context behavior undefined. | Added `00b` Section 6.3b. Evidence class split (`context` vs. `finding`), promotion as new record creation (not mutation), archive disposition, governance guardrails. |
| V-04 | Med | Tier 2 correction boundary too broad. Location corrections could sprawl. | Added `00b` Section 6.9b. Hard permit/prohibit list with asset-remapping rule. System enforcement language replacing UI prompt language. |
| V-05 | Med | Session-local precedence had no expiry or reconciliation enforcement. | Added `00b` Section 6.5b. Archive gate as state machine precondition. Reconciliation approver role defined. Full-offline edge case addressed. |
| V-06 | Low | Section 12.4 unnamed pricing authority. | Corrected to name `06_Pricing_Manifest_Framework` explicitly. |

---

'@

$content = Insert-Before -text $content -needlePattern "## SECTION B — MASTER DOCUMENT TABLE" -insertBlock $newCritique -label "Insert v0.4 critique before Section B"

$content = Update-MasterTable -content $content

$sectionB1 = @'

### Section B.1 — Canonical Data Model v0.4 (Entity + Asset/Zone Model Detail)

This is the authoritative map-level statement of what `03` must include.

**Runtime Data Entities:**
Customer, Property, Session, Finding, Evidence, Interpretation, Recommendation, Estimate Option, Document Artifact, Audit Event, QA Approval Event, Certificate Eligibility Record.

**Spatial Reference Hierarchy (Asset/Zone Model):**
The following entities form a parent-child containment tree. This hierarchy is the authoritative reference for "distinct asset" determination in Tier 2 correction boundaries and multi-unit property reporting.

```
Property
  └── Structure        (physical building or unit: main house, garage, Unit 3A)
        └── Zone       (spatial area: first floor, attic, crawlspace)
              └── System    (mechanical system: HVAC, ventilation, ductwork)
                    └── Equipment  (specific piece: air handler, coil, blower motor)
```

Findings are associated with a location expressed as a path through this hierarchy. Minimum specificity: Zone level. Full specificity: Equipment level.

**Data Attribute Note:**
The Evidence entity must include an `evidence_class` attribute with permitted values: `context` | `finding`. This attribute governs whether an Evidence record satisfies finding evidence minimums and whether it is eligible for customer-facing renders.

'@

$content = Insert-Before -text $content -needlePattern "---\r?\n\r?\n## SECTION C — RECOMMENDED BUILD ORDER" -insertBlock $sectionB1 -label "Insert Section B.1 before Section C divider"

$content = Replace-One -text $content -pattern '^\| 11 \| `04b` \| State Transition Model \| (.*?) \|$' -replacement {
  param($m)
  $gate = $m.Groups[1].Value
  if ($gate -match "Additionally required:") { return $m.Value }
  return '| 11 | `04b` | State Transition Model | ' + $gate + ' Additionally required: (1) Hard-Stop flag fields confirmed as read-only across all states with no TIS write path — each of the five flags validated individually; (2) Evidence entity `evidence_class` attribute (`context` | `finding`) included in the state-tracked schema; (3) `archived` transition precondition formally includes Class A reconciliation gate (pass / reject / defer-with-reason); (4) `pending_supersession` artifact status defined as a valid transition state for Class II and III artifacts; (5) Full-offline connectivity resume: hard-stop check defined as first sync operation; (6) Explicit Correction/Revision state or transition path exists for Tier 2 corrections post-`presented`. |'
} -label "Append Phase 2 04b gate condition"

$content = Replace-One -text $content -pattern '^\| 12 \| `04c` \| Audit Trail Spec \| (.*?) \|$' -replacement {
  param($m)
  $gate = $m.Groups[1].Value
  if ($gate -match "Additionally required:") { return $m.Value }
  return '| 12 | `04c` | Audit Trail Spec | ' + $gate + ' Additionally required: (1) Delivery channel tracking defined as an auditable record type — system must record what channels were used to deliver each Class II and Class III artifact; (2) `pending_supersession` entry, cancellation, and successor-issuance transitions are auditable events; (3) Hard-stop flag activation, push, and technician notification are auditable events; (4) Offline hard-stop resolution on connectivity resume is an auditable event. |'
} -label "Append Phase 2 04c gate condition"

$content = Replace-One -text $content -pattern '^\| 13 \| `04` \| TIS Field and Sync Model \| (.*?) \|$' -replacement {
  param($m)
  $gate = $m.Groups[1].Value
  if ($gate -match "Additionally required:") { return $m.Value }
  return '| 13 | `04` | TIS Field and Sync Model | ' + $gate + ' Additionally required: (1) Appendix B must confirm all five Hard-Stop flags are read-only in TIS — write attempt generates error and audit event; (2) Hard-stop push on sync defined: TIS surfaces flag to technician immediately, applicable blocks enforce per Section 3.6 continuation rules; (3) Sync event payload includes `evidence_class` on all Evidence records; (4) Offline hard-stop behavior defined: If TIS is offline, hard-stop status cannot be confirmed. Maximum offline duration before offline-unconfirmed warning activates on contracting actions must be specified. On connectivity resume, hard-stop check is first sync operation. Any contracting actions taken during offline period that would have been blocked are flagged for office review. `do_not_service` and `unsafe_entry_restriction` override any prior authorization — work must stop even if previously authorized. |'
} -label "Append Phase 2 04 gate condition"

$content = Replace-One -text $content -pattern '^\| 16 \| `07` \| Field Workflow Spec \| (.*?) \|$' -replacement {
  param($m)
  $gate = $m.Groups[1].Value
  if ($gate -match "Additionally required:") { return $m.Value }
  return '| 16 | `07` | Field Workflow Spec | ' + $gate + ' Additionally required: (1) Sweep-to-context capture mode tap sequence and mode indicator defined; (2) Promotion workflow from context to finding-class evidence — accessible, low-friction, clearly labeled; (3) Hard-stop surface UX: what the technician sees for each of the five hard-stop flags, which actions become unavailable, how to contact office; (4) Offline-unconfirmed warning UX for contracting actions when hard-stop status cannot be confirmed; (5) Tier 2 vs. Tier 3 correction type selection at revision initiation; (6) Delivery event recording: `07` must specify how artifact delivery events are recorded so that tombstone enforcement can be applied to delivered artifacts. Every customer-facing artifact delivery is a recordable event. |'
} -label "Append Phase 3 07 gate condition"

$content = Replace-One -text $content -pattern '^\| 17 \| `09` \| Media Capture and Evidence Standard \| (.*?) \|$' -replacement {
  param($m)
  $gate = $m.Groups[1].Value
  if ($gate -match "Additionally required:") { return $m.Value }
  return '| 17 | `09` | Media Capture and Evidence Standard | ' + $gate + ' Additionally required: (1) `context` evidence class defined — labeling convention, storage behavior, exclusion from customer-facing renders, archive disposition (retained internally, not customer-accessible); (2) `finding` evidence class defined — minimum thresholds per finding type; (3) Explicit rule: context-class evidence does not count toward finding evidence minimums; (4) Promotion data operation defined in alignment with `00b` Section 6.3b: new `finding`-class record, source `context` record retained with `promoted_to` reference; (5) QA-reportable threshold for excessive context-only usage defined with a specific threshold. |'
} -label "Append Phase 3 09 gate condition"

$content = Replace-One -text $content -pattern '(\| `00b` \| `01`, `02` \| )`03`, `05c`, `07`' -replacement '${1}`03`, `04b`, `05c`, `07`, `09`' -label "Dependency matrix 00b downstream"
$content = Replace-One -text $content -pattern '(\| `04b` \| )`03`(\s+\|)' -replacement '${1}`03`, `00b`${2}' -label "Dependency matrix 04b upstream"
$content = Replace-One -text $content -pattern '(\| `09` \| )`03`, `07`(\s+\|)' -replacement '${1}`03`, `07`, `00b`${2}' -label "Dependency matrix 09 upstream"

$content = Replace-One -text $content -pattern "No circular dependencies detected in v0\.3\." -replacement "No circular dependencies detected in v0.4." -label "Circular dependency sentence"
$content = Replace-One -text $content -pattern "\*End of Document — v0\.3\*" -replacement "*End of Document — v0.4*" -label "End-of-document version"

$content = Replace-One `
  -text $content `
  -pattern '^\*\*Review gate:\*\*[^\r\n]*$' `
  -replacement '**Review gate:** This document passes review when: (1) all structural holes are acknowledged and dispositioned, (2) every V1 document has a row in the master table with all 10 columns populated, (3) dependency matrix has no circular dependencies (verified in Section D), (4) build order sequence is consistent with dependency matrix, (5) every document''s authority hierarchy position is known or deferred to `05c`, (6) tombstone class (I/II/III) assignments for `11a–11h` are recorded in the master table (including `11b` II → III transition and `11d` regulated-context escalation note), (7) architect and PM have signed off.' `
  -label "Replace Section E review gate line"

$openItems = @'

## SECTION G — OPEN ITEMS NOT YET RESOLVED

> Two items identified in the operator critique remain open. They are not resolved by v0.4. They require dedicated attention before final lock.

| Item | Status | Required Before |
|------|--------|-----------------|
| `03` Asset/Zone schema fully specified (field-level definitions for Structure, Zone, System, Equipment and their relationship attributes) | ⬜ Not Started | Phase 2 begin (`04b` depends on knowing what "distinct asset" means at the field level) |
| Offline maximum sync gap value defined (the threshold after which offline-unconfirmed warning activates on contracting actions) | ⬜ Not Started | `04` and `07` lock (both reference this threshold but neither can define it without Ops Lead input on real field operating conditions) |

---

'@

$content = Insert-Before -text $content -needlePattern "## SECTION F — DEFERRED DOCUMENT REGISTER" -insertBlock $openItems -label "Insert open items section before Section F"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $DestPath) | Out-Null
Set-Content -LiteralPath $DestPath -Value $content -NoNewline

Write-Output "Wrote: $DestPath"
