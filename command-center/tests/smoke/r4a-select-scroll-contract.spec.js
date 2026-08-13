/* eslint-disable testing-library/prefer-screen-queries, jest/valid-title */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

// R4A — Office Inspection Customer Selector Usability.
// Static contract test (no server / no Supabase required). It locks the shared
// Select primitive fix so a future edit cannot silently reintroduce the defect
// that made long customer lists unscrollable / unreachable.

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const SELECT_PRIMITIVE = 'src/components/ui/select.jsx';

test('shared Select viewport is height-bounded so long lists cannot run off-screen', () => {
  const source = read(SELECT_PRIMITIVE);
  // Bound the scrollable viewport to the popper available height (fallback 24rem).
  expect(source).toContain('max-h-[min(24rem,var(--radix-select-content-available-height,24rem))]');
});

test('shared Select no longer pins the popper viewport to the trigger height', () => {
  const source = read(SELECT_PRIMITIVE);
  // The fixed trigger-height pin fought natural scroll flow and was part of the
  // root cause; it must not come back.
  expect(source).not.toContain('h-[var(--radix-select-trigger-height)]');
});

test('shared Select re-enables a visible scrollbar Radix hides by default', () => {
  const source = read(SELECT_PRIMITIVE);
  // Radix injects scrollbar-width:none + ::-webkit-scrollbar{display:none} on the
  // viewport. The fix must override that so a real scrollbar shows where the
  // browser renders one (Edge/Chrome via webkit, Firefox via scrollbar-width).
  expect(source).toContain('![scrollbar-width:thin]');
  expect(source).toContain('[&::-webkit-scrollbar]:![display:block]');
});

test('shared Select still renders the Radix viewport around its children', () => {
  const source = read(SELECT_PRIMITIVE);
  // Structural guard: the fix must not have removed the viewport that hosts the
  // options (which would break every consumer dropdown).
  expect(source).toMatch(/SelectPrimitive\.Viewport[\s\S]*\{children\}[\s\S]*SelectPrimitive\.Viewport/);
});
