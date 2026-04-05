# Transaction Document Blueprint

## Purpose

This document is the production blueprint for TVG transaction documents:

- `estimate`
- `quote`
- `invoice`
- `receipt`

It defines four layers:

1. Field schema
2. Page-master rules
3. Document content rules
4. State/change/version rules

This is not a design brief. It is the operating contract for document behavior, layout discipline, scope protection, and payment clarity.

## Current System Mapping

The current data model already has a usable base:

- `public.estimates`
- `public.quotes`
- `public.quote_items`
- `public.jobs`
- `public.invoices`
- `public.invoice_items`
- `public.transactions`
- receipt delivery via `send-receipt` and `_shared/receiptUtils.ts`

Important current fields already present:

- `estimates`: `estimate_number`, `services`, `property_details`, `scope_of_work`, `total_price`, `lead_id`, `customer_email`, `property_id`, `tenant_id`
- `quotes`: `quote_number`, `status`, `subtotal`, `tax_rate`, `tax_amount`, `total_amount`, `valid_until`, `header_text`, `footer_text`, `sent_at`, `viewed_at`, `accepted_at`, `rejected_at`, `rejection_reason`, `estimate_id`, `customer_email`, `tenant_id`, `public_token`, `line_items`, `service_address`
- `jobs`: `quote_id`, `quote_number`, `work_order_number`, `service_address`, `customer_type_snapshot`, `payment_terms`, `access_notes`, `payment_status`
- `invoices`: `invoice_number`, `status`, `subtotal`, `tax_rate`, `tax_amount`, `total_amount`, `amount_paid`, `balance_due`, `due_date`, `paid_at`, `payment_method`, `notes`, `terms`, `sent_at`, `viewed_at`, `public_token`, `job_id`, `quote_id`, `estimate_id`, `customer_email`, `line_items`, `invoice_type`, `release_approved`
- `transactions`: `invoice_id`, `amount`, `type`, `method`, `external_payment_id`, `status`, `tenant_id`

Key gap:

- there is no dedicated `receipt` table today

Recommended rule:

- receipts remain a derived document generated from `invoice + transaction(s) + delivery event`
- do not create a standalone receipt table unless later needed for archival or signed receipt versions

## Layer 1: Field Schema

### 1.1 Canonical Field Groups

Every transaction document should be modeled from the same field groups.

#### Identity

- `document_type`
- `document_id`
- `document_number`
- `job_id`
- `tenant_id`
- `related_estimate_id`
- `related_quote_id`
- `related_invoice_id`
- `related_work_order_number`
- `document_version`
- `document_revision_reason`
- `source_snapshot_id`

Current mapping:

- estimate: `estimates.id`, `estimate_number`
- quote: `quotes.id`, `quote_number`
- invoice: `invoices.id`, `invoice_number`
- receipt: derived from `invoice_id + transaction id(s)`

Required next:

- `document_version`
- `source_snapshot_id`
- `document_revision_reason`

#### Commercial Summary

- `status`
- `issue_date`
- `valid_through`
- `due_date`
- `payment_terms`
- `invoice_type`
- `subtotal`
- `discount_amount`
- `tax_rate`
- `tax_amount`
- `fees_amount`
- `total_amount`
- `amount_paid`
- `balance_due`
- `payment_instructions`
- `deposit_required`
- `deposit_amount`

Current mapping:

- quotes: `status`, `valid_until`, `subtotal`, `tax_rate`, `tax_amount`, `total_amount`
- jobs: `payment_terms`
- invoices: `status`, `issue_date`, `due_date`, `invoice_type`, `subtotal`, `tax_rate`, `tax_amount`, `total_amount`, `amount_paid`, `balance_due`

Required next:

- `fees_amount`
- `payment_instructions`
- `deposit_required`
- `deposit_amount`

#### Customer / Property / AP

- `customer_name`
- `company_name`
- `customer_email`
- `customer_phone`
- `property_name`
- `service_address`
- `building_name`
- `unit_reference`
- `batch_reference`
- `po_number`
- `po_required`
- `accounting_contact`

Current mapping:

- leads and related joins provide customer identity
- quotes and jobs already use `service_address`
- invoices and jobs support work-order linkage

Required next:

- `property_name`
- `building_name`
- `unit_reference`
- `batch_reference`
- `po_number`
- `po_required`
- `accounting_contact`

#### Scope / Service

- `service_summary`
- `scope_snapshot_text`
- `included_items`
- `excluded_items`
- `assumptions_text`
- `exclusions_text`
- `service_verification_text`
- `photos_available`
- `airflow_verified`
- `access_method`
- `service_date`
- `service_window`

Current mapping:

- estimates: `scope_of_work`, `services`
- quotes: `line_items`, `service_address`
- jobs: `access_notes`, `scheduled_start`, `completed_at`
- invoices: `notes`, `terms`

Required next:

- `scope_snapshot_text`
- `included_items`
- `excluded_items`
- `assumptions_text`
- `exclusions_text`
- `service_verification_text`
- `photos_available`
- `airflow_verified`
- `access_method`
- `service_date`
- `service_window`

#### Approval / Contract Control

- `approval_required`
- `approval_method`
- `approved_by_name`
- `approved_by_email`
- `approved_at`
- `approved_version`
- `change_order_required`
- `change_order_id`
- `dispute_protection_line`

Current mapping:

- quotes: `accepted_at`, `rejected_at`, `rejection_reason`
- public approval flow updates quote status and creates jobs

Required next:

- `approval_method`
- `approved_by_name`
- `approved_by_email`
- `approved_version`
- `change_order_required`
- `change_order_id`
- `dispute_protection_line`

#### Payment / Receipt

- `payment_reference_number`
- `payment_method`
- `payment_status`
- `payment_received_at`
- `payment_amount`
- `remaining_balance`
- `payment_provider`
- `payment_intent_id`
- `transaction_id`
- `paid_in_full`

Current mapping:

- invoices: `payment_method`, `paid_at`
- transactions: `amount`, `method`, `status`, `external_payment_id`
- receipt utils already pass `amountPaid`, `paidAt`, `method`, `provider`, `transactionId`, `paymentIntentId`

Required next:

- `payment_reference_number`
- `remaining_balance`
- `paid_in_full`

#### Delivery / Audit

- `public_token`
- `sent_at`
- `viewed_at`
- `delivery_channel`
- `last_delivery_status`
- `created_by`
- `updated_by`
- `released_for_send`

Current mapping:

- quotes and invoices: `public_token`, `sent_at`, `viewed_at`
- invoices: `release_approved`

Required next:

- `delivery_channel`
- `last_delivery_status`
- `updated_by`

#### Internal Control Fields

These are system-facing fields for renderer control, release discipline, and audit traceability.

- `template_version`
- `render_profile`
- `generated_by`
- `release_checked_by`
- `document_freeze_at`
- `snapshot_hash`
- `snapshot_storage_mode`

Required next:

- `template_version`
- `render_profile`
- `generated_by`
- `release_checked_by`
- `document_freeze_at`
- `snapshot_hash`
- `snapshot_storage_mode`

### 1.2 Document-Specific Required Fields

#### Estimate

Minimum required:

- `document_type`
- `document_id`
- `document_number`
- `job_id` or lead-linked temporary job identity
- `status`
- `customer_name`
- `service_address`
- `service_summary`
- `scope_snapshot_text`
- `assumptions_text`
- `subtotal`
- `total_amount`
- `valid_through`

Optional:

- `unit_reference`
- `batch_reference`
- `service_window`
- `photos_available`

#### Quote

Minimum required:

- all estimate minimums, plus:
- `quote_number`
- `approved_version`
- `dispute_protection_line`
- `included_items`
- `excluded_items`
- `approval_required`
- `approval_method`
- `payment_terms`

Optional:

- `deposit_required`
- `deposit_amount`
- `po_required`
- `po_number`

#### Invoice

Minimum required:

- `invoice_number`
- `job_id`
- `related_quote_id`
- `status`
- `issue_date`
- `due_date`
- `customer_name`
- `service_address`
- `service_date`
- `payment_terms`
- `line_items`
- `subtotal`
- `tax_amount`
- `total_amount`
- `amount_paid`
- `balance_due`
- `payment_instructions`
- `dispute_protection_line`
- `service_verification_text`

Optional:

- `po_number`
- `unit_reference`
- `batch_reference`
- `airflow_verified`
- `photos_available`

#### Receipt

Minimum required:

- `invoice_number`
- `job_id`
- `status`
- `customer_name`
- `service_address`
- `payment_amount`
- `payment_method`
- `payment_received_at`
- `payment_reference_number`
- `paid_in_full` or `remaining_balance`

Optional:

- `transaction_id`
- `payment_provider`
- `review_url`

### 1.3 Receipt Data Rule

Receipt documents are derived from:

- `invoices`
- `transactions`
- receipt delivery metadata

Recommended receipt payload:

- invoice identity
- job identity
- payment event identity
- amount paid
- method
- paid timestamp
- remaining balance or `Paid in Full`

No independent receipt authoring flow should exist.

### 1.4 Snapshot Storage Rule

Approved and sent documents require two forms of evidence:

- canonical JSON snapshot for logic, audit, and change enforcement
- rendered artifact snapshot for human proof, typically HTML and/or PDF

Recommended storage model:

- `snapshot_storage_mode = both`

Rules:

- quote approval must freeze a canonical JSON snapshot
- sent quote and sent invoice must preserve the rendered artifact actually delivered
- receipt payloads remain derived, but they must be reconstructible from invoice + transaction + delivery metadata

## Layer 2: Page-Master Rules

### 2.1 Page Types

There are exactly three page masters.

#### First Page

Purpose:

- establish trust
- identify the document
- surface price and scope quickly

Allowed:

- horizontal logo
- formal credential strip
- scan-first block
- client/property block
- scope summary
- condensed pricing

Not allowed:

- long terms
- long exclusions
- approval block if document spans multiple pages

#### Interior Page

Purpose:

- continuation only

Allowed:

- continued pricing
- assumptions
- exclusions
- add-ons
- service notes
- batch / unit schedule

Not allowed:

- mascot
- tagline
- hero pricing block
- approval CTA
- new scope introduction

#### Final Page

Purpose:

- financial closure
- action

Required order:

1. totals
2. payment terms / remit instructions
3. approval or signature control
4. final legal or dispute-protection note

### 2.2 Margin and Frame Rules

All pages use a hard content frame:

- top: `0.5in`
- bottom: `0.5in`
- left: `0.5in` to `0.6in`
- right: `0.5in` to `0.6in`

Rules:

- all critical content must sit inside the content frame
- header and footer live in reserved zones
- footer is never allowed to float based on content

### 2.3 Header and Footer Rules

#### First Page Header

- horizontal logo
- document type
- scan-first commercial summary

#### Interior / Final Header

- compact horizontal logo
- document type
- document number
- job ID
- property or address
- `Page X of Y`

#### Footer

Always locked to the same bottom position.

Footer contains:

- company contact line
- compact badge row
- page number if not already in header

Page 1 may include the tagline.
Interior pages must not.

### 2.4 Page Break Authority

Page breaks are intentional.

#### Atomic sections

Must never split:

- client/property block
- scan-first block
- scope snapshot
- totals block
- approval block

#### Splittable sections

May split cleanly:

- line-item tables
- assumptions
- exclusions
- add-on lists
- unit schedules

When a table splits:

- repeat the column header
- label as `Pricing (continued)` or equivalent

### 2.5 Density Rules

If a page contains:

- more than 2 major sections
- or more than 1 dense table

then split the page.

Footer protection rule:

- if content reaches `85%` to `90%` of usable height, break to next page

### 2.6 Null and Empty Rendering Policy

Rules:

- hide optional rows or sections when data is absent
- never render empty labels
- never render placeholder punctuation
- never render `N/A` unless it adds business meaning
- if no PO exists, omit the PO row entirely
- if no batch reference exists, collapse the block cleanly
- if no optional badge exists, remove it without spacing artifacts

### 2.7 Black-and-White Print Rule

Critical meaning must survive grayscale printing.

Rules:

- status must never rely on color alone
- dividers and emphasis must rely on contrast, not tint alone
- tables must remain legible in grayscale
- badges and trust marks must remain recognizable in black and white
- approval emphasis must remain understandable without filled background color

## Layer 3: Document Content Rules

### 3.1 Global Rules

Every customer-facing document must answer in 10 seconds:

1. What is this?
2. Who is it for?
3. What is the amount?
4. What happens next?

No customer-facing page may include internal or explanatory design language.

### 3.2 Scan-First Block

Required on:

- quote
- invoice
- receipt

Optional on:

- estimate

Fields:

- document number
- job ID
- property name
- service address
- total
- status
- PO number if present

### 3.2.1 Display Label Separation Rule

Field names and display labels must be separate.

Examples:

- `balance_due` -> `Balance Due`
- `total_amount` -> `Total Investment` on quote
- `total_amount` -> `Total Invoice` on invoice
- `payment_received_at` -> `Date Paid` on receipt

Rules:

- templates must not depend directly on raw field names for customer-facing copy
- display labels may vary by document type while raw schema keys remain stable

### 3.3 Required Protection Lines

#### Dispute kill-switch line

Required on quote and invoice:

`All services, scope, and pricing are tied to the approved quote version referenced in this document.`

#### Service verification hook

Required on invoice, recommended on quote:

`Service documented with pre/post photos and airflow verification.`

### 3.4 Document-Specific Content Rules

#### Estimate

Must contain:

- estimate snapshot
- scope narrative
- assumptions
- exclusions
- projected pricing
- next-step statement

Must not contain:

- binding approval language that implies execution

#### Quote

Must contain:

- scan-first block
- committed scope
- included vs not included
- pricing
- validity window
- approval path
- dispute protection line

Must not contain:

- vague estimate language

#### Invoice

Must contain:

- scan-first block
- bill-to and service location
- service summary
- line items
- totals
- balance due
- due date
- payment instructions
- PO reference if applicable
- service verification hook
- dispute protection line

Must not contain:

- optional upgrades mixed into billed scope

#### Receipt

Must contain:

- payment confirmation
- invoice reference
- amount paid
- method
- date paid
- paid-in-full or remaining balance

Must not contain:

- new upsell content
- new scope language

### 3.5 Multi-Unit / Batch Rules

Quotes and invoices must support:

- `unit_reference`
- `batch_reference`
- `Units Serviced: X of Y`
- `See attached unit schedule` pattern

If units are too many for the page:

- attach a unit schedule
- reference it explicitly in the document body

### 3.6 Release Checklist

Documents must pass a release checklist before send.

#### Quote release checklist

- required fields present
- `document_version` assigned
- scope snapshot present
- totals reconcile
- page count stable
- approval placement correct
- PO field resolved if applicable
- dispute line present
- null rendering pass clean

#### Invoice release checklist

- required fields present
- totals reconcile
- service date present
- balance due correct
- payment instructions present
- dispute line present
- service verification line present
- release approval present if status will become `sent`
- null rendering pass clean

#### Receipt release checklist

- invoice paid state or payment event confirmed
- payment amount matches the selected transaction payload
- payment method present
- payment timestamp present
- balance outcome is clear: `Paid in Full` or remaining balance

### 3.7 Quote Fixture Set

Before live renderer implementation, maintain a quote fixture set.

Minimum fixture set:

- one-page residential quote
- two-page residential quote
- multi-unit property-manager quote with PO
- quote with long exclusions
- quote with continued pricing table
- quote that forces final-page approval

Purpose:

- validate page-master behavior
- validate null rendering behavior
- validate overflow behavior
- validate final-page approval behavior before live integration

### 3.8 Conversion Language Rules

Use subtle conversion bias, not sales copy.

Examples:

- `Approve to Schedule Service`
- `Total Investment`
- `Payment Due`

Do not use conversion language on receipts.

## Layer 4: State, Change, and Version Rules

### 4.1 Core Principle

Once a document is sent, it is immutable.

No silent edits.

Allowed actions after send:

- create a new version
- create a revised document
- create a change order
- create a credit memo

Not allowed:

- overwrite a sent customer-facing document in place

### 4.1.1 Document Freeze Rule

Every customer-facing artifact must record a freeze moment.

Required:

- `document_freeze_at`

Meaning:

- the timestamp when the rendered artifact was finalized for release

Rules:

- `document_freeze_at` is distinct from `sent_at`
- a document may be frozen before it is delivered
- the frozen artifact must remain reproducible

### 4.2 Document State Rules

#### Estimate

Recommended statuses:

- `draft`
- `sent`
- `viewed`
- `expired`
- `converted`
- `void`

#### Quote

Current and recommended statuses:

- `draft`
- `pending_review`
- `sent`
- `viewed`
- `approved`
- `declined`
- `expired`
- `void`

Rules:

- approval locks the approved version and scope snapshot
- declined quotes may not become invoices
- sent quotes may not be edited in place
- revised quotes require a new version and revision reason after `v1`

#### Invoice

Current and recommended statuses:

- `draft`
- `sent`
- `partial`
- `paid`
- `overdue`
- `void`

Rules:

- `sent` requires release approval
- `paid` requires `balance_due <= 0` or a paid event
- `partial` requires `amount_paid > 0` and `balance_due > 0`
- cancelled jobs are not billable
- sent invoices may not be edited in place

#### Receipt

Receipt is event-derived, not manually authored.

Recommended receipt delivery states:

- `pending`
- `sent`
- `sent_sms`
- `skipped`
- `suppressed`
- `failed`

### 4.3 Transformation Rules

#### Estimate -> Quote

Allowed:

- scope edits
- price edits
- assumptions resolved or carried forward

Required:

- estimate assumptions must be explicitly resolved, carried, or removed

#### Quote -> Approved Quote Snapshot

On approval:

- lock scope
- lock price
- lock version
- store approved snapshot
- lock line-item meaning

Required next field set:

- `approved_version`
- `source_snapshot_id`

#### Quote -> Invoice

Locked:

- approved scope
- approved pricing
- approved unit set

Allowed changes without change order:

- payment application
- payment status
- internal release approval

Any change to:

- scope
- access method
- quantity
- unit list
- materials
- price

requires a change order.

Line-item drift rule:

- approved quote line items become part of the locked snapshot
- invoice line items may reference approved quote line items
- invoice line items may not materially rewrite approved scope language without a change order

### 4.4 Change Order Rules

A change order is required when:

- scope increases or decreases materially
- access method changes
- additional units are added
- field conditions differ from assumptions
- labor or material cost materially changes

Rules:

- invoice must not include unapproved scope
- final invoice references the original quote plus approved change orders

### 4.5 Revision Naming Convention

Use stable base document numbers with explicit versions.

Examples:

- `Q-2026-0147 v1`
- `Q-2026-0147 v2`
- `INV-2026-0319 v1`

Rules:

- `v1` is the initial issued version
- any post-issue change creates a new version
- version increments must not overwrite prior customer-facing artifacts
- revision reason is required after `v1`
- `Revised Quote` or `Revised Invoice` is a display label, not a replacement for version identity

### 4.6 Final Page Closure Rule

The final page may:

- summarize
- total
- instruct
- collect approval

The final page may not:

- introduce new scope
- introduce new pricing categories
- change customer understanding of the job

### 4.7 Credit Memo and Void Policy

Define correction behavior before implementation.

#### Void

Use when:

- the document was issued in error and should no longer be collectible or actionable

Rules:

- original document remains historically visible
- status becomes `void`
- replacement document requires a new version or new document number according to business policy

#### Revised document

Use when:

- customer-facing content must change before settlement

Rules:

- do not overwrite the original
- issue a new version
- preserve revision reason

#### Credit memo

Use when:

- value has already been billed or settled and must be reduced or reversed

Rules:

- original invoice remains visible
- credit memo references the original invoice
- net financial effect must be traceable

### 4.8 Audit and Replication Rules

Every document system change must pass:

- AP scan test
- black-and-white print test
- mobile readability test
- multi-page overflow test
- dispute survival test
- franchise usability test

Franchise usability test:

- a trained new user should be able to generate the correct document without breaking version or approval rules

## Recommended Implementation Order

1. Add missing field definitions to the document schema contract
2. Implement page-master constraints in the template renderer
3. Add approved scope snapshot and version fields
4. Enforce no-silent-edits in save/update paths
5. Add PO, unit reference, batch reference, and dispute-protection fields to quote and invoice flows
6. Refactor estimate, quote, invoice, and receipt templates to consume the same canonical field groups

## Immediate Build Targets

For the next implementation pass, the system should support these minimum additions:

- `document_version`
- `source_snapshot_id`
- `approved_version`
- `po_number`
- `po_required`
- `unit_reference`
- `batch_reference`
- `scope_snapshot_text`
- `assumptions_text`
- `exclusions_text`
- `service_verification_text`
- `approval_method`
- `approved_by_name`
- `approved_by_email`
- `document_revision_reason`

These fields are enough to make the document system durable without overbuilding it.
