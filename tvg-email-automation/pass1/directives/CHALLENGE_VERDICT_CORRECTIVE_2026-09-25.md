# Challenge verdict — Corrective Staging Slice (2026-09-25 ~14:15 ET)
CHALLENGE_CONCERNS — proceed-with-concerns. No block reasons.
Acceptance criteria added:
1. Token scope: Worker allowlists GET only against specific message metadata/text/source endpoints; code guard refuses non-GET or other paths. "Read-only if available" unverified until proven.
2. Base URL defaults to mock (or disabled), never live. Flip to api.mail.hostinger.com is an explicit CC/Founder-gated step at the reopened window, with host allowlist. Evidence records base URL per smoke run.
3. Unknown payload shape / mailboxResourceId: fail to HOLD with clear reason, never guess. Do not claim "real retrieval verified" until controlled live test passes.
4. Stuck row uid 924150001: state explicitly whether claimed against mock (expected HOLD/not found), excluded, or left untouched; must not trigger live fetch.
5. Later live test: confirm fetch does not mark read/move/change flags in Hostinger mailbox; document if it does before window.
6. Missing Authentication-Results/raw source -> identity uncertain -> HOLD. Add size and timeout limits for large bodies/attachments.
Open questions: (a) does Hostinger token support scope restriction? (b) who owns base-URL flip at test window (CC answer sufficient).
