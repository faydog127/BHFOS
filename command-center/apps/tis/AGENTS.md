# AGENTS.md — TIS sub-app rules

## Scope
These rules apply when working in the TIS app.

## Objective
Preserve TIS as an independently deployable sub-app under `/tis/`.

## Hard rules
- TIS is not a sidecar of the root CRM deploy.
- Do not change root CRM files unless the task explicitly requires coordinated multi-app work.
- Treat `/public_html/tis/` as an isolated deploy target.
- Preserve TIS asset path correctness under `/tis/`.

## Deploy expectations
Any TIS deploy work must:
- identify whether the task is local build, packaging, upload, extraction, or smoke test
- avoid touching root `/public_html/` unless explicitly requested
- verify:
  - `/tis/` returns TIS HTML
  - `/tis/assets/...` bundle returns 200
  - root `/` still returns CRM if the task could affect shared hosting

## Frontend expectations
- prioritize correctness of base paths and asset paths
- preserve SPA routing assumptions if present
- prefer minimal layout and bundling changes over broad reconfiguration

## Completion bar
A TIS task is not done unless:
- the target path is correct
- the build output is correct
- the smoke test passes
- the risk to CRM is explicitly stated when relevant

