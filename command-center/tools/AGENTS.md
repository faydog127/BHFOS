# AGENTS.md — tools and generators

## Scope
These rules apply to scripts, generators, report pipelines, and deploy helpers.

## Objective
Keep tools deterministic, explainable, and safe for repeated use.

## Hard rules
- prefer deterministic logic over heuristic magic
- log or expose the reason for decisions when practical
- avoid silent fallbacks in deploy and report-generation paths
- fail loudly on missing critical inputs
- never allow placeholder text into customer-facing outputs

## Report generation rules
For customer-facing reports:
- prioritize stable layout in HTML and PDF
- keep summary sections concise and structured
- protect pagination and section integrity
- source customer/property metadata from workflow data, not placeholders

## Validation rules
When changing a tool:
- identify the smallest validation that proves the change
- distinguish unit validation from end-to-end validation
- state what cases were tested and what cases were not

