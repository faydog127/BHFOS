# Codex deploy template

Objective:
[Deploy or harden a deploy path.]

Deploy target:
[root CRM | TIS | other]
Exact path:
[Example: /public_html/tis/]

Constraints:
- do not overwrite unrelated apps
- preserve existing live behavior unless explicitly changing it
- fail loudly if smoke checks fail

Required checks:
- [ ] target app route returns correct HTML
- [ ] required asset bundle returns 200
- [ ] related sibling app still works if relevant

Instructions:
1. Inspect current deploy scripts and packaging paths.
2. Identify overwrite risk.
3. Make the smallest safe change.
4. Add or improve smoke checks if missing.
5. Report exact risk and exact validation outcome.

Definition of done:
- deploy path is explicit
- unrelated app paths are preserved
- smoke checks pass

