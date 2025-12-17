# [ChatGPT] Response – Re-Group Command Center (Vercel) Requirements

Role: Strategic Advisor & Process Designer  
Date: 2025-12-17  
Status: Draft

## SUMMARY (3 sentences max)

Build a lightweight Next.js app on Vercel that mirrors a private GitHub repo and gives you a clean, non-coder dashboard view of work status. v1 is read-only (PRs, Issues, Decisions, Sprint), optimized for clarity and “what needs my attention.” v1.1 adds approvals/actions once the read-only mirror is stable.

## ALIGNMENT CHECK

[x] Mission-aligned (Honest, Protective, Professional)  
[x] Franchise-grade (non-expert operator can execute)  
[x] Capital-efficient (lean, phased build)  
[x] Within scope (mirror GitHub; approvals later)  
[x] Respects technical constraints  
[x] No scope creep

---

## DELIVERABLE

### 1) Product Name

**Re-Group Command Center** (aka “Command Center”)

### 2) Purpose

A “single pane of glass” that mirrors GitHub (source of truth) and reduces your cognitive load by showing:

- what’s happening
- what’s blocked
- what needs your approval
- what the current sprint goal is  
  …without making you live in GitHub.

### 3) Non-Goals (Hard Boundaries)

- Not a replacement for GitHub
- No code editing in the browser
- No auto-merge, auto-deploy, or autonomous commits
- No “second database” of tasks (GitHub remains truth)
- No fancy UI framework requirements in v1 (clarity > style)

---

## 4) Users & Access Model

### Primary user

- **You** (Admin / Approver / Release Captain)

### Secondary viewers (optional)

- View-only collaborators (future-ready)

### Authentication (Dashboard login)

- **Google Auth** for dashboard access (you sign in with Google)

### Authorization (GitHub access to private repo)

The app must be able to **read** from a private GitHub repo in v1. In v1.1, it must be able to **submit PR reviews** (Approve/Request changes) under the approved authorization method.

> Decision note: GitHub authorization method can be GitHub App or PAT-based for MVP—implementation choice later. Requirements only state capabilities.

---

## 5) Information Architecture (Pages)

### v1 (Read-only) – Required pages

1. **Home / Overview**
   - Current H1 goal / sprint goal (pulled from a repo file)
   - Summary tiles:
     - Open PRs
     - PRs needing review
     - PRs failing checks
     - Blocked issues
   - “Needs your attention” queue (top 5)

2. **Pull Requests Inbox**
   - List open PRs with:
     - title
     - author
     - labels (if any)
     - CI/check status (pass/fail/pending)
     - review status (needs review / changes requested / approved)
     - updated time
   - Filters: Ready, Blocked, Needs Review, Failing Checks
   - Clicking PR opens PR Detail

3. **PR Detail (Read-only v1)**
   - PR title, description, linked issue/TASK reference
   - Checks summary (pass/fail/pending)
   - Review summary (who reviewed, current state)
   - Key metadata: files changed count, commits count
   - Link button: “Open in GitHub” (escape hatch)

4. **Tasks (Issues)**
   - List GitHub Issues filtered by label `re-group`
   - Group by status using labels or GitHub fields (minimum viable):
     - To Do
     - In Progress
     - Blocked
     - Done
   - Each issue shows: title, labels, assignee, updated time

5. **Decisions**
   - Render decision docs stored in repo under: `re-group/03-decisions/`
   - Show list with: filename, date, short excerpt
   - Click to view the decision content

6. **Sprint / Horizon**
   - Render: `re-group/04-implementation/current-sprint.md`
   - Shows:
     - Horizon H1 objective
     - this week’s focus
     - current blockers
     - next decisions needed

---

## 6) Data Sources (GitHub is Truth)

### Required GitHub data

- Pull Requests: list, detail, reviews, check runs/status
- Issues: list + labels + assignees
- Repo files: read markdown contents for sprint + decisions

### Required Repo Conventions (so the dashboard stays simple)

- Re-Group content lives under `/re-group/…`
- Decisions finalized only when placed in `/re-group/03-decisions/`
- Sprint status is always in `/re-group/04-implementation/current-sprint.md`
- Re-Group work items use a label: `re-group`

---

## 7) Actions (Phased)

### v1 (Read-only)

- No write actions required

### v1.1 (Approval actions – required later)

- From PR Detail:
  - Approve
  - Request changes (requires comment)
  - Comment (optional)
- Safety: a confirmation modal before sending an approval/request-changes
- All actions must be logged in an internal audit view or simple “Activity Log” page (v1.1)

---

## 8) UX Requirements (Non-coder-first)

- “Needs your attention” is always visible within 1 click
- Status is expressed in plain English:
  - “Checks failing” not “CI red”
  - “Waiting for review” not “awaiting approvals”
- Every page includes an “Open in GitHub” escape hatch
- No deep nesting: max 2 clicks to reach PR detail
- Mobile usable (readable, tappable)

---

## 9) Performance & Reliability

- Dashboard loads key overview content in < 3 seconds on normal broadband
- Handle GitHub rate limits gracefully (show message + retry suggestion)
- Clear error states:
  - “GitHub authorization expired”
  - “Repo not accessible”
  - “No items match filter” (not a blank screen)

---

## 10) Security Requirements

- No secrets in client-side code
- All GitHub credentials stored as server-side env vars in Vercel
- Least privilege permissions to the repo
- Audit trail for v1.1 actions (who approved what, when)

---

## 11) Definition of Done

### v1 Done when:

- You can sign in with Google
- You can see: Home, PR Inbox, PR Detail, Tasks, Decisions, Sprint
- Data reflects the private repo accurately
- You can click from the dashboard to the matching PR/Issue/Decision in GitHub

### v1.1 Done when:

- From the dashboard you can Approve / Request Changes on a PR
- The PR’s state in GitHub updates correctly
- Actions are logged and visible

---

## DEPENDENCIES

Requires:

- Private GitHub repo + repo owner/admin access (to create auth method)
- Repo contains `/re-group/` structure (or will be added)
- Vercel project created
- Google OAuth credentials for the dashboard domain

Blocks:

- Write actions (v1.1) blocked until GitHub auth method is chosen/implemented

---

## QUESTIONS FOR HUMAN

1. What is the GitHub repo owner context: **personal account or org**?
2. Should the dashboard be **you-only** at launch, or include **view-only** accounts day one?

---

## NEXT STEP

Submit a Horizons request: **“Re-Group Command Center v1 (Read-only Mirror)”** using the above requirements, then assign:

- Claude: choose GitHub auth method + endpoints needed + security notes
- GPT: convert this into TASK-001..TASK-00X breakdown with acceptance criteria
- Codex: implement v1 once TASKs are approved

---

## VALIDATION CRITERIA

- PR list matches GitHub open PRs count and titles
- At least one PR detail view loads checks + review summary correctly
- Issues list filtered by `re-group` label matches GitHub
- Decisions page renders markdown from `/03-decisions/` without formatting breakage
- Sprint page renders `current-sprint.md` reliably

