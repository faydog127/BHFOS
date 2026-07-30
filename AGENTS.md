# Agent operating rules (repository authority)

Git, the actual worktree, tests, and tracked status documents are authoritative.
Cursor conversations are disposable and must never be the only source of build state.

## Session rules

1. Each chat receives **one bounded mission** with a defined finish line.
2. Every session begins by verifying: repository path, branch, `HEAD`, worktree, upstream divergence, and applicable instructions (`AGENTS.md`, `command-center/docs/RELAY_PROTOCOL.md`, and domain status docs).
3. Preserve existing work. Do **not** reset, revert, clean, switch branch, or run destructive recovery without explicit authorization.
4. Implementation claims require inspection and verification (read the tree; run the relevant tests). Do not trust chat memory alone.
5. Each meaningful accepted workstream must update `command-center/docs/media-intelligence/IMPLEMENTATION_STATUS.md` (or the applicable domain status doc).
6. Verified work should be committed in bounded local commits when authorized by the mission.
7. Remote push, migration apply, secret changes, deployment, merge, and production actions require their applicable **explicit** authorization. Local commit ≠ remote write.
8. Fresh chats that finish a mission must end with the standardized **RELAY HANDOFF** (see `command-center/docs/RELAY_PROTOCOL.md`).

## Hard constraints

- `command-center/build-out.txt` must **never** be modified, deleted, ignored, staged, or committed.
- Media Intelligence Library (MIL) remains **single-company**. Do not introduce speculative multi-tenancy or ownership entities.
- Client-side hiding is **not** authorization. RLS / server grants are authoritative.
- Staging evidence must be distinguished from local evidence.
- Do **not** label these as equivalent: source-present · locally verified · deployed · staging verified · merged · production verified.

Full relay procedure: [`command-center/docs/RELAY_PROTOCOL.md`](command-center/docs/RELAY_PROTOCOL.md).
