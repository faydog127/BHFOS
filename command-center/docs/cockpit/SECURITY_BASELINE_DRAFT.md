# BHFOS Cockpit Security Baseline — Draft

**Date:** 2026-10-01  
**Status:** DRAFT — planning/security baseline; not merged; not implementation-authorized  
**Scope:** BHFOS Cockpit and shared repository/build controls that materially affect Cockpit security  
**Repository:** `faydog127/BHFOS`

## Security objective

Cockpit will connect to customer records, work orders, email, scheduling, financial status, external platforms, and eventually multiple BHFOS products. It must therefore be treated as a high-value operational control plane.

No release is considered ready merely because the product works functionally.

Security acceptance must address:

- source-code and supply-chain integrity;
- malware and malicious-file handling;
- secrets and credentials;
- identity, RBAC, RLS/data scope, and domain authorization;
- external connector authority;
- prompt injection and untrusted content;
- financial and customer-commitment controls;
- auditability;
- recoverability;
- incident response.

The goal is risk reduction and evidence-backed security. No artifact may claim that the product is absolutely "malware-free" or "vulnerability-free." The release must instead show that defined preventive, detective, and recovery controls have passed.

## 1. Repository visibility

**Required posture:** private repository unless an explicit later product decision requires public source.

Current verified state on 2026-10-01: `faydog127/BHFOS` is **public**.

Before sensitive Cockpit implementation, production credentials, private customer integration details, or proprietary operating logic are added, repository visibility must be reviewed and moved to **private**.

Visibility change must account for GitHub-plan effects on:

- code scanning / CodeQL;
- secret scanning / push protection;
- Dependabot custom rules;
- public forks;
- GitHub Pages if used.

If moving private removes free GitHub security features, equivalent CI controls must be added before treating the private state as an improvement.

## 2. Branch and merge protection

`main` must remain protected.

Minimum required controls:

- PR required for changes;
- required CI checks;
- security checks required before merge once implemented;
- no direct production mutation from unreviewed branches;
- exact-head evidence for governed merges;
- force-push disabled except documented break-glass process;
- deletion protection for governed release branches where appropriate;
- CODEOWNERS or equivalent review ownership for security-sensitive paths when team structure supports it.

Current verified required checks on `main` include:

- `lint`
- `build`
- `ledger_lock`

Security checks are not yet a required merge gate.

## 3. GitHub Actions / CI supply-chain controls

All third-party GitHub Actions should be pinned to immutable commit SHAs rather than mutable version tags.

Current CI uses tag references such as:

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`

Required remediation:

- pin actions to reviewed commit SHAs;
- document the human-readable release tag in comments;
- review updates intentionally;
- set explicit minimal `permissions:` at workflow or job level;
- do not expose secrets to untrusted fork / PR execution;
- avoid `pull_request_target` for untrusted code unless a narrowly reviewed use case requires it;
- limit artifact retention and avoid secrets in logs;
- use timeouts and concurrency controls where applicable.

## 4. Dependency / package security

The build must maintain lockfiles and use deterministic installs.

Required controls:

- `npm ci` rather than unconstrained install in CI;
- automated vulnerable-dependency detection;
- dependency-update review;
- software bill of materials (SBOM) or equivalent dependency inventory for releases;
- package provenance / signature checks where practical;
- review of new dependencies before adoption;
- no abandoned or unnecessary package accepted merely for convenience;
- explicit review of lifecycle scripts for high-risk dependency changes;
- separation of dev-only and production dependencies;
- no automatic major-version dependency merge without review.

A dependency vulnerability scan must pass the release threshold before implementation acceptance.

## 5. Static application security testing

Before production release, run a repeatable SAST check for JavaScript / TypeScript and backend code.

Preferred layers:

- CodeQL when available for the repository plan;
- or a governed equivalent such as Semgrep / other approved scanner;
- lint rules for dangerous patterns;
- security-focused tests for auth, input validation, and data boundaries.

High / critical findings block release unless a written accepted-risk record is approved by the proper authority.

## 6. Secret detection

No credentials, API keys, tokens, service-role secrets, passwords, private keys, webhook secrets, or customer secrets may be committed to the repository.

Required controls:

- secret scanning on every PR / push through GitHub Secret Protection where available or a CI equivalent;
- push protection where available;
- CI scan with an approved secret scanner when GitHub secret scanning is unavailable;
- secrets stored only in approved encrypted secret stores;
- rotate any secret exposed to source control, logs, chat, screenshots, or artifacts;
- never pass raw credentials into model context;
- prevent secrets from appearing in build artifacts and client bundles.

## 7. Malware and untrusted file handling

Cockpit will ingest or link to email attachments, photos, PDFs, documents, invoices, and field evidence. These are untrusted inputs.

Uploads / attachments must not become executable content merely because an authorized user received them.

Required controls:

1. quarantine newly uploaded files before trusted use;
2. validate extension, declared MIME type, and file signature / magic bytes;
3. enforce file-size and file-count limits;
4. reject executable / script formats unless a separately approved workflow requires them;
5. malware scan using an approved engine / service before downstream processing;
6. use isolated processing for document conversion, image processing, OCR, or metadata extraction;
7. never execute macros or embedded scripts;
8. re-encode images where appropriate rather than trusting original binary payloads;
9. serve uploaded content with safe content-disposition and content-type behavior;
10. use short-lived signed URLs and least-privilege storage policies;
11. keep original evidence immutable where evidentiary requirements require retention, while processing derivatives separately;
12. log malware detections and prevent the file from reaching technicians / admins until resolved.

## 8. Inbound email and prompt-injection security

Inbound email and customer / work-order text are **untrusted content**.

A message may contain instructions intended to manipulate an AI system.

Binding rule:

> Untrusted inbound content can provide data; it cannot raise authority.

Required controls:

- separate message parsing from action execution;
- never let email text grant permission to send, pay, alter pricing, approve NTE, change credentials, or cross data scopes;
- use structured extraction into bounded fields;
- action decisions pass through policy / authorization independently of message text;
- sanitize rendered HTML;
- prevent remote-content tracking where appropriate;
- verify sender / domain only as evidence, not automatic authority;
- protect against malicious attachments and links;
- preserve original source and provenance.

## 9. Authentication

Required baseline:

- individual user accounts; no shared human login;
- strong MFA for Founder / admin and any privileged users;
- secure session management;
- revocable sessions;
- short-lived elevated privilege where practical;
- account lock / rate limiting appropriate to the identity provider;
- no client-side role claim treated as sufficient authority without server-side enforcement;
- terminated personnel lose access promptly.

## 10. Authorization: RBAC + data scope + domain rules

Roles alone are insufficient.

Cockpit must enforce:

- identity;
- role-based permission;
- organization / business scope;
- record / data scope;
- domain-specific authorization;
- source-system authority;
- action consequence / amount limits where applicable.

Initial role concepts:

- Founder / Owner
- Admin / Dispatcher
- Technician
- System / integration actor

Technicians must not gain broad customer, financial, admin, or cross-account access merely because they can view an assigned work order.

## 11. RLS / backend enforcement

Where Supabase / PostgreSQL or an equivalent backend is used:

- RLS must protect authoritative business data where appropriate;
- server-side domain authorization must guard mutations that RLS alone cannot express safely;
- service-role credentials must never be exposed to clients;
- no generic client-side-only authorization;
- tests must include deny-path cases;
- cross-entity TVG / BHIS / Network OS data must not be exposed by convenience joins or shared unrestricted tables.

## 12. Connector credentials and external systems

Each connector receives the least privilege required.

Required:

- encrypted credential storage;
- separate credentials by environment where possible;
- rotate / revoke support;
- explicit read vs write authority;
- token expiry handling;
- webhook signature verification where supported;
- replay protection;
- idempotency for write actions;
- no browser automation with stored raw credentials when a safer contract exists;
- connector outage must fail honestly, not fabricate success.

External writes are complete only after authoritative confirmation / receipt.

## 13. Financial security

Financial state is a high-impact domain.

Required:

- Finance remains the governed financial authority where designated;
- Cockpit does not invent a second ledger;
- no silent payment, refund, write-off, pricing, discount, or NTE authorization;
- amount / currency / customer / invoice identity must be explicit;
- duplicate payment / invoice protection;
- reconciliation;
- immutable audit evidence for material mutations;
- stronger approval rules for irreversible / out-of-policy actions.

## 14. Customer commitments

Customer-facing sends, schedules, NTE approvals, scope commitments, service credits, and contractual statements require explicit authority.

AI may draft / prepare.

AI may execute only under an approved standing policy or explicit human authorization appropriate to consequence.

## 15. Input and web security

Required web-app controls include as applicable:

- output encoding;
- DOM / HTML sanitization;
- CSRF protection where cookie auth requires it;
- SSRF defenses on server-side URL fetches;
- SQL injection prevention through parameterization / safe client APIs;
- path traversal prevention;
- file upload restrictions;
- secure headers;
- Content Security Policy;
- clickjacking defense;
- rate limiting;
- secure cookies;
- CORS restrictions;
- redirect allowlists;
- webhook validation;
- safe error handling with no secret leakage.

## 16. Logging and audit

Separate:

- operational event history;
- external-system action receipts;
- approval history;
- integration execution logs;
- security / administrative audit.

Logs must not contain raw credentials, full payment secrets, authorization headers, or unnecessary PII.

Material actions require enough context to reconstruct:

- who / what acted;
- authority used;
- target;
- before / after where appropriate;
- timestamp;
- result / receipt;
- trace identifier.

## 17. Data minimization and retention

Collect only information required to run the business.

Define retention / deletion rules for:

- customer PII;
- emails;
- work-order evidence;
- photos;
- payment metadata;
- logs;
- AI context / transcripts;
- archived clients;
- deleted records.

Archive should normally preserve required operational / financial history.

Permanent deletion must be restricted and auditable.

## 18. Backups and recovery

Security includes availability.

Required:

- database backups;
- tested restore process;
- configuration / migration recovery;
- protected credential recovery path;
- deployment rollback;
- integration reconciliation after outage;
- documented RPO / RTO appropriate to production maturity.

A backup is not considered a control until restore has been tested.

## 19. Environment separation

Development / test must not casually use production customer data.

Required:

- separate environment credentials;
- synthetic / sanitized test data by default;
- no service-role production secret in local or PR environments;
- production actions clearly labeled and governed;
- preview builds cannot mutate production data unless explicitly designed and authorized.

## 20. Security review gates

Before a Cockpit implementation slice reaches production:

- threat model reviewed;
- architecture / data-flow review complete;
- auth / authorization deny-path tests pass;
- dependency scan passes threshold;
- secret scan passes;
- SAST passes threshold;
- malware-upload controls tested for slices that handle files;
- connector permissions verified;
- RLS / domain authorization evidence complete where applicable;
- security-relevant deviations disclosed;
- rollback / incident path documented;
- challenge reviewer security review passes.

## 21. Severity posture

Draft release rule:

- **Critical:** blocks merge / production.
- **High:** blocks production unless formally remediated or accepted by required authority.
- **Medium:** remediation plan and owner required; may block depending on exposure.
- **Low / informational:** track and address proportionately.

No security finding is dismissed solely because the product is "internal."

## 22. Security cannot depend on AI judgment alone

AI may assist with:

- threat modeling;
- code review;
- anomaly detection;
- security-test generation;
- log summarization;
- dependency / finding triage.

AI must not become sole authority for:

- accepted risk;
- credential access;
- security-boundary changes;
- destructive remediation;
- financial-security policy;
- production incident closure.

## Current evidence and gaps — 2026-10-01

Verified:

- repository visibility: **public**;
- repository owner type: personal GitHub user;
- `main` protected;
- required status checks include `lint`, `build`, `ledger_lock`;
- CI uses `npm ci`;
- ledger-lock workflow declares `permissions: contents: read`.

Observed gaps / follow-up:

- main CI workflow does not declare an explicit top-level minimal `permissions:` block;
- GitHub Actions are referenced by mutable major-version tags rather than immutable SHAs;
- no security status check is currently required by branch protection;
- Dependabot / code-scanning / secret-scanning alert endpoints were not accessible through the current ChatGPT GitHub connector, so enablement cannot be claimed;
- local `npm audit` could not be completed from the current container because outbound network resolution is unavailable;
- private-repository GitHub security feature availability must be checked against the account / plan before relying on GitHub-native scanning after the visibility change.

These gaps are to be resolved through the security hardening workstream before production authorization.
