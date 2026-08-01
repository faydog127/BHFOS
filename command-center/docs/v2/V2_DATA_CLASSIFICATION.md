# BHFOS V2 — Data Classification

| Field | Value |
| --- | --- |
| Status | Active |
| Version | 0.1 |
| Owner | Founder |
| Last reviewed | 2026-08-01 |
| Implementation authority | Active governance authority; policy only |

## Purpose

This policy defines how V2 identifies and handles information based on its sensitivity.

## Classification levels

| Classification | Examples | Basic handling |
| --- | --- | --- |
| Public | Published marketing content, public service descriptions | May be publicly shared when approved |
| Internal | Product plans, non-sensitive procedures, ordinary technical documentation | Limited to authorized business and development use |
| Confidential | Pricing strategy, contracts, internal financial performance, unpublished product plans | Restricted access; do not place in public repositories or public AI contexts |
| Restricted | Customer PII, payment information, authentication secrets, precise technician location, sensitive property media | Minimum necessary access, protected storage, controlled logging and retention |

## Important data categories

| Category | Default classification |
| --- | --- |
| Customer name, phone, email and address | Restricted |
| Property access instructions | Restricted |
| Job-site photos and videos | Restricted unless approved for public use |
| Technician GPS and route history | Restricted |
| Estimates, invoices and payment history | Confidential or Restricted |
| Full payment-card data | Must not be stored by BHFOS |
| Payment-provider IDs and tokens | Restricted |
| API keys, passwords and signing secrets | Restricted |
| Internal source code | Internal or Confidential |
| Approved marketing media | Public after explicit approval |

## Requirement rule

Every requirement must identify:

- data touched;
- classification;
- users or roles with access;
- storage location;
- retention or deletion needs;
- logging restrictions;
- whether the information may appear in screenshots, fixtures, test records, or AI prompts.
