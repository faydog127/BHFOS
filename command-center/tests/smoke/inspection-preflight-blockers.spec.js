/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import { test, expect } from '@playwright/test';
import {
  buildPreflightBlockerModel,
  enrichPreflightIssues,
  groupPreflightBlockers,
} from '../../src/lib/inspectionPreflightBlockers.js';

test('groups preflight issues by type with counts and plain-English labels', async () => {
  const groups = groupPreflightBlockers([
    { code: 'FINDING_WITHOUT_EVIDENCE', finding_id: 'f1', message: 'Customer-visible finding has no eligible linked evidence.' },
    { code: 'FINDING_WITHOUT_EVIDENCE', finding_id: 'f2', message: 'Customer-visible finding has no eligible linked evidence.' },
    { code: 'CONTRADICTORY_COMPONENT_CONCLUSION', finding_id: 'f3', conflicting_finding_id: 'f4', message: 'One approved finding says the component cannot be assessed while another recommends corrective work.' },
    { code: 'SUMMARY_REQUIRED', message: 'Review and accept the generated inspection summary.', action: 'Edit summary' },
  ]);

  expect(groups).toHaveLength(3);
  const missingEvidence = groups.find((group) => group.key === 'missing_evidence');
  expect(missingEvidence.title).toBe('Findings missing evidence');
  expect(missingEvidence.count).toBe(2);
  expect(missingEvidence.findingIds.sort()).toEqual(['f1', 'f2']);
  expect(missingEvidence.actionLabel).toBe('Open affected findings');
  expect(missingEvidence.tab).toBe('findings');

  const contradictory = groups.find((group) => group.key === 'contradictory_findings');
  expect(contradictory.count).toBe(1);
  expect(contradictory.findingIds.sort()).toEqual(['f3', 'f4']);

  const summary = groups.find((group) => group.key === 'summary_required');
  expect(summary.actionLabel).toBe('Edit summary');
  expect(summary.tab).toBe('overview');
});

test('enriches recommendation and AI blockers from loaded local rows', async () => {
  const enriched = enrichPreflightIssues(
    [
      { code: 'RECOMMENDATION_REQUIRED', message: 'Each customer-visible finding needs a selected recommendation.' },
      { code: 'AI_DECISIONS_PENDING', message: 'One or more photos still need a technician decision.' },
    ],
    {
      findings: [
        { id: 'f-ok', is_customer_visible: true },
        { id: 'f-missing', is_customer_visible: true },
        { id: 'f-internal', is_customer_visible: false },
      ],
      recommendations: [
        { id: 'r1', finding_id: 'f-ok', is_customer_visible: true },
      ],
      aiSuggestions: [
        { id: 's1', photo_id: 'p1', status: 'pending' },
        { id: 's2', photo_id: 'p1', status: 'pending' },
        { id: 's3', photo_id: 'p2', status: 'accepted' },
      ],
    },
  );

  expect(enriched[0].finding_ids).toEqual(['f-missing']);
  expect(enriched[1].photo_ids.sort()).toEqual(['p1']);

  const model = buildPreflightBlockerModel(enriched);
  expect(model.highlights.findingIds).toEqual(['f-missing']);
  expect(model.highlights.photoIds).toEqual(['p1']);
  expect(model.groups.map((group) => group.title)).toEqual([
    'Service recommendation required',
    'Photos need a technician decision',
  ]);
});

test('does not invent generic review-affected-content actions', async () => {
  const groups = groupPreflightBlockers([
    { code: 'NO_CUSTOMER_FINDINGS', message: 'No findings are approved for the customer report.', action: 'Review finding' },
  ]);
  expect(groups[0].actionLabel).toBe('Review findings and photo decisions');
  expect(groups[0].actionLabel.toLowerCase()).not.toContain('affected report content');
});
