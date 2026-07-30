# Cursor Relay Protocol

Operational handoff for repository-based continuity. Conversations are disposable; Git and tracked docs are not.

## 1. When to start a fresh chat

Start a new chat when:

- The current mission’s finish line is reached (or blocked on authorization).
- Context is polluted, lost, or unrecoverable.
- Role changes (implement → review/certify/merge/deploy must not share a chat).
- Scope would expand beyond the one assigned mission.

Do **not** continue a finished mission “just to keep going.” Hand off and stop.

## 2. Session-opening verification (required)

Before editing, verify and record:

| Check | Command / source |
|---|---|
| Repository | `git rev-parse --show-toplevel` |
| Branch | `git branch --show-current` |
| HEAD | `git rev-parse HEAD` |
| Worktree | `git status --porcelain=v1` |
| Upstream divergence | `git rev-list --left-right --count origin/<branch>...HEAD` |
| Applicable instructions | Root `AGENTS.md`, this file, domain status docs |

If any check fails or disagrees with the mission brief, stop and report — do not invent a recovery path.

## 3. One mission per chat

- One operational problem / bounded finish line.
- No unrelated cleanup, no speculative architecture, no silent scope expansion.
- If the root cause differs materially from the brief, stop and hand off.

## 4. Implementation and test evidence

- Inspect the tree before claiming behavior.
- Prefer focused tests for behavior changes; document why if a test cannot exist.
- Label evidence honestly: **SOURCE-ONLY** · **locally verified** · **staging** · **deployed** · **merged** · **production**. Never equate them.
- SQL suite PASS on a disposable local stack ≠ staging proof.

## 5. Status-file updates

After meaningful accepted work, update the domain status doc (MIL: `docs/media-intelligence/IMPLEMENTATION_STATUS.md`):

- Actual verified HEAD and upstream divergence at edit time
- What is locally proven vs staging-unproven
- Exact next executable action + authorization boundary
- Do not claim remote apply, deploy, merge, or production without evidence

## 6. Commit and remote-authorization boundaries

| Action | Default |
|---|---|
| Local bounded commit | Allowed when the mission authorizes it |
| Push / merge / deploy | Explicit authorization required |
| Migration apply / secrets | Explicit authorization required |
| Production | Explicit authorization required |

Local commit is not remote write. Do not push “to finish the handoff.”

## 7. Failure recovery

Recover from **Git + repository documents**, not chat memory:

1. Re-verify repository / branch / HEAD / worktree / upstream.
2. Read `AGENTS.md`, this protocol, and the domain `IMPLEMENTATION_STATUS` (or equivalent).
3. Diff against the last verified tip; resume only accepted, committed work.
4. Never reset / revert / clean / switch branch without explicit authorization.
5. Never re-implement accepted items from missing chat memory.

## 8. Standardized RELAY HANDOFF

Every finished (or blocked) fresh-chat mission ends with exactly these fields:

```text
RELAY HANDOFF
- Repository / branch:
- HEAD / baseline ancestry:
- Upstream divergence:
- Worktree:
- Verified implementation state:
- Verification commands / results:
- Accepted changes:
- Remaining defects or uncertainties:
- Exact next action:
- Authorization boundary:
```

Keep each field factual and short. Prefer SHAs and command results over narrative.

## MIL-specific reminders

- Preserve `command-center/build-out.txt` untouched (untracked; never ignore/stage/commit).
- Single-company only; client hide ≠ authz.
- Staging apply packet is prep only until Founder authorizes execution.
