/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import {
  buildConditionsFingerprint,
  buildFindingsNarrative,
  listApprovedConditions,
  resolveNarrativeStatusForFingerprint,
} from '../../src/lib/inspectionFindingsNarrative.js';

test('Phase B hardening: approval rules and source-field exclusions', async () => {
  const suggestions = [
    { id: 's-accept', status: 'accepted', suggestion_type: 'finding' },
    { id: 's-edit', status: 'edited', suggestion_type: 'finding' },
    { id: 's-reject', status: 'rejected', suggestion_type: 'finding' },
    { id: 's-irrelevant', status: 'irrelevant', suggestion_type: 'finding' },
    { id: 's-pending', status: 'pending', suggestion_type: 'finding' },
  ];

  const findings = [
    {
      id: 'ai-ok',
      title: 'Lint in duct',
      description: 'Lint accumulation was observed in the dryer exhaust package area during the estimate walkthrough test',
      recommended_action: 'Complete dryer vent cleaning',
      suggested_unit_price: 299,
      is_customer_visible: false,
      source_ai_suggestion_id: 's-accept',
      condition_status: 'draft',
    },
    {
      id: 'ai-edited',
      title: 'Restricted airflow',
      description: 'Restricted airflow was observed at the termination',
      recommended_action: 'Price-book package: Complete dryer vent cleaning',
      is_customer_visible: false,
      source_ai_suggestion_id: 's-edit',
      condition_status: 'draft',
    },
    {
      id: 'ai-reject',
      title: 'Rejected dust',
      description: 'Should not appear rejected',
      source_ai_suggestion_id: 's-reject',
      condition_status: 'approved',
    },
    {
      id: 'ai-irrelevant',
      title: 'Not relevant stain',
      description: 'Should not appear irrelevant',
      source_ai_suggestion_id: 's-irrelevant',
      condition_status: 'approved',
    },
    {
      id: 'manual-draft',
      title: 'Unapproved manual',
      description: 'Draft manual condition must stay out',
      source_ai_suggestion_id: null,
      condition_status: 'draft',
    },
    {
      id: 'manual-approved',
      title: 'Approved manual',
      description: 'Blower dust was observed on accessible surfaces near the air package',
      recommended_action: 'Total Home Air Restoration',
      source_ai_suggestion_id: null,
      condition_status: 'approved',
    },
    {
      id: 'manual-rejected',
      title: 'Rejected manual',
      description: 'Rejected manual must stay out',
      source_ai_suggestion_id: null,
      condition_status: 'rejected',
    },
    {
      id: 'manual-voided',
      title: 'Voided manual',
      description: 'Voided manual must stay out',
      source_ai_suggestion_id: null,
      condition_status: 'voided',
    },
    {
      id: 'manual-not-relevant',
      title: 'Not relevant manual',
      description: 'Not relevant manual must stay out',
      source_ai_suggestion_id: null,
      condition_status: 'not_relevant',
    },
  ];

  const photos = [
    {
      id: 'p1',
      finding_id: 'ai-ok',
      caption: 'Lint visible along the lower duct surface after the package test',
      is_voided: false,
      upload_state: 'complete',
    },
    {
      id: 'p-void',
      finding_id: 'manual-approved',
      caption: 'Voided evidence should not appear',
      is_voided: true,
      upload_state: 'complete',
    },
  ];

  const recommendations = [
    { id: 'r1', finding_id: 'ai-ok', title: 'Complete dryer vent cleaning', suggested_unit_price: 249 },
  ];

  const approved = listApprovedConditions(findings, suggestions);
  expect(approved.map((row) => row.id).sort()).toEqual(['ai-edited', 'ai-ok', 'manual-approved']);

  const narrative = buildFindingsNarrative(findings, suggestions, photos);
  expect(narrative).toMatch(/Lint accumulation was observed in the dryer exhaust package area during the estimate walkthrough test/i);
  expect(narrative).toMatch(/Restricted airflow was observed at the termination/i);
  expect(narrative).toMatch(/Blower dust was observed on accessible surfaces near the air package/i);
  expect(narrative).toMatch(/Supporting photos document Lint visible along the lower duct surface after the package test/i);

  // Recommendation / pricing content must not enter via those source fields.
  expect(narrative).not.toMatch(/Complete dryer vent cleaning|Total Home Air Restoration|\$|249|299|price-book/i);
  expect(narrative).not.toMatch(/Should not appear|Draft manual|Rejected manual|Voided manual|Not relevant manual|Voided evidence/i);

  // Passing recommendation rows into the builder is unsupported; narrative ignores them.
  const withRecNoise = buildFindingsNarrative(findings, suggestions, photos, recommendations);
  expect(withRecNoise).toBe(narrative);

  const fingerprint = buildConditionsFingerprint(findings, suggestions, photos);
  expect(resolveNarrativeStatusForFingerprint({
    summaryStatus: 'accepted',
    storedFingerprint: fingerprint,
    currentFingerprint: fingerprint,
  })).toBe('accepted');
  expect(resolveNarrativeStatusForFingerprint({
    summaryStatus: 'accepted',
    storedFingerprint: fingerprint,
    currentFingerprint: `${fingerprint}|changed`,
  })).toBe('stale');
  expect(resolveNarrativeStatusForFingerprint({
    summaryStatus: 'edited',
    storedFingerprint: fingerprint,
    currentFingerprint: `${fingerprint}|changed`,
  })).toBe('stale');
});
