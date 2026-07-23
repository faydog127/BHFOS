import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260723160000_ml_p1_s8_inspection_checklist.sql'),
  'utf8',
);

test('ML-P1 S8 migration seeds checklist + retention + photos-before-report', () => {
  assert.match(mig, /inspection_checklist_templates/);
  assert.match(mig, /inspection_checklist_responses/);
  assert.match(mig, /flag_code text NOT NULL DEFAULT 'none'/);
  assert.match(mig, /inspection\.offline_cache_mb', '250'/);
  assert.match(mig, /inspection\.photo_retention_months', '24'/);
  assert.match(mig, /ml_p1_s8_assert_photos_before_report/);
  assert.match(mig, /ml_p1_s8_mark_photos_wave_complete/);
  assert.doesNotMatch(mig, /CREATE TABLE.*photo_bundles/i);
  assert.doesNotMatch(mig, /invoice_auto_charge_enabled.*true/i);
});

test('ML-P1 S8 field stepper includes checklist after photos', () => {
  const stepper = fs.readFileSync(
    path.join(root, 'src/components/tech/InspectionFieldStepper.jsx'),
    'utf8',
  );
  assert.match(stepper, /id: 'photos'/);
  assert.match(stepper, /id: 'checklist'/);
  assert.ok(stepper.indexOf("id: 'photos'") < stepper.indexOf("id: 'checklist'"));
  assert.ok(stepper.indexOf("id: 'checklist'") < stepper.indexOf("id: 'findings'"));
});

test('ML-P1 S8 offline queue enforces 250MB budget', () => {
  const queue = fs.readFileSync(path.join(root, 'src/lib/offlineInspectionMediaQueue.js'), 'utf8');
  assert.match(queue, /DEFAULT_OFFLINE_CACHE_MB = 250/);
  assert.match(queue, /enforceCacheBudget/);
  assert.match(queue, /ML_P1_S8_OFFLINE_CACHE_FULL/);
});

test('ML-P1 S8 review gates report behind photo assert', () => {
  const review = fs.readFileSync(path.join(root, 'src/pages/tech/TechInspectionReview.jsx'), 'utf8');
  assert.match(review, /ml_p1_s8_assert_photos_before_report/);
});

test('ML-P1 S8 office list surfaces open flags', () => {
  const list = fs.readFileSync(path.join(root, 'src/pages/crm/Inspections.jsx'), 'utf8');
  assert.match(list, /ml_p1_s8_inspection_open_flags/);
  assert.match(list, /flagMap/);
});
