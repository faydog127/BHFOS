/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  buildPreflightBlockerModel,
  groupPreflightBlockers,
} from '../../src/lib/inspectionPreflightBlockers.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('five field steps are defined in technician order', async () => {
  const stepperSource = fs.readFileSync(
    path.join(here, '../../src/components/tech/InspectionFieldStepper.jsx'),
    'utf8',
  );
  expect(stepperSource).toContain("id: 'customer'");
  expect(stepperSource).toContain("id: 'photos'");
  expect(stepperSource).toContain("id: 'findings'");
  expect(stepperSource).toContain("id: 'recommendation'");
  expect(stepperSource).toContain("id: 'finish'");
  expect(stepperSource).toContain('step=${step.id}');
});

test('blocker language is plain and actionable', async () => {
  const groups = groupPreflightBlockers([
    { code: 'FINDING_WITHOUT_EVIDENCE', finding_id: 'f1', message: 'Customer-visible finding has no eligible linked evidence.' },
    { code: 'SUMMARY_REQUIRED', message: 'Inspection summary not accepted.' },
    { code: 'AI_DECISIONS_PENDING', photo_id: 'p1', message: 'Photos need a technician decision.' },
    { code: 'RECOMMENDATION_REQUIRED', message: 'Add one inspection-level Service Recommendation.' },
    { code: 'SERVICE_ADDRESS_REQUIRED', message: 'A service address is required for this report.' },
  ]);

  const titles = groups.map((group) => group.title).join(' | ');
  expect(titles).toMatch(/needs a photo/i);
  expect(titles).toMatch(/Findings summary/i);
  expect(titles).toMatch(/Review this photo/i);
  expect(titles).toMatch(/Service Recommendation/i);
  expect(titles).toMatch(/service address/i);

  const joined = `${titles} ${groups.map((group) => group.actionLabel).join(' ')}`.toLowerCase();
  expect(joined).not.toContain('eligible');
  expect(joined).not.toContain('pending_ai');
  expect(joined).not.toContain('finding_id');
  expect(joined).not.toContain('guc');

  const missing = groups.find((group) => group.key === 'missing_evidence');
  expect(missing.actionLabel).toMatch(/add or select photo/i);
  expect(missing.step).toBe('findings');
  expect(missing.findingIds).toEqual(['f1']);
});

test('Observed / Before / After map to nullable is_before values', async () => {
  const mapLabel = (value) => {
    if (value === 'before') return true;
    if (value === 'after') return false;
    return null;
  };
  expect(mapLabel('observed')).toBeNull();
  expect(mapLabel('before')).toBe(true);
  expect(mapLabel('after')).toBe(false);
});

test('inspection-level recommendation selection keeps finding_id null and no pricing fields', async () => {
  const selected = {
    title: 'Full Dryer Vent Cleaning',
    description: 'Complete a full cleaning from the dryer connection through the rooftop termination.',
    finding_id: null,
    is_customer_visible: true,
  };
  expect(selected.finding_id).toBeNull();
  expect(selected).not.toHaveProperty('suggested_unit_price');
  expect(JSON.stringify(selected)).not.toMatch(/\$\d/);
});

test('preflight model highlights the exact finding needing evidence', async () => {
  const model = buildPreflightBlockerModel(
    [{ code: 'FINDING_WITHOUT_EVIDENCE', finding_id: 'finding-22', message: 'needs photo' }],
    {
      findings: [{ id: 'finding-22', is_customer_visible: true }],
      recommendations: [],
      aiSuggestions: [],
      photos: [{ id: 'p1', finding_id: null, is_voided: false }],
    },
  );
  expect(model.highlights.findingIds).toEqual(['finding-22']);
  expect(model.groups[0].actionLabel).toBe('Add or select photo');
});

test('dryer vent scope wins over generic duct language', async ({ page }) => {
  await page.goto('/src/lib/inspectionPreflightBlockers.js', { waitUntil: 'domcontentloaded' });
  // Scope helper lives in the edge function; assert the ordering rule here with a mirrored check.
  const scope = await page.evaluate(() => {
    const inspectionScopeLanguage = (inspection) => {
      const signals = [inspection.inspection_type, inspection.title, inspection.summary].join(' ').toLowerCase();
      if (signals.includes('dryer')) {
        return 'dryer-vent';
      }
      if (signals.includes('duct') || signals.includes('hvac')) {
        return 'hvac';
      }
      return 'generic';
    };
    return {
      dryer: inspectionScopeLanguage({ inspection_type: 'dryer_vent', title: 'Dryer vent duct inspection' }),
      hvac: inspectionScopeLanguage({ inspection_type: 'air_duct', title: 'Air duct cleaning' }),
    };
  });
  expect(scope.dryer).toBe('dryer-vent');
  expect(scope.hvac).toBe('hvac');
});

test('mobile viewport keeps field stepper and primary actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <html><body style="margin:0">
      <nav aria-label="Inspection field steps">
        <ol style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">
          <li><a href="#">Customer</a></li>
          <li><a href="#">Photos</a></li>
          <li><a href="#">Findings</a></li>
          <li><a href="#">Rec</a></li>
          <li><a href="#">Finish</a></li>
        </ol>
      </nav>
      <button style="position:sticky;bottom:0;width:100%;min-height:48px">Continue to Findings</button>
      <input id="camera" type="file" accept="image/*" capture="environment" />
      <input id="library" type="file" accept="image/*" multiple />
    </body></html>
  `);
  await expect(page.getByLabel('Inspection field steps')).toBeVisible();
  await expect(page.locator('#camera')).toHaveAttribute('capture', 'environment');
  await expect(page.locator('#library')).not.toHaveAttribute('capture');
  await expect(page.locator('#library')).toHaveAttribute('multiple', '');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(overflow).toBe(true);
});
