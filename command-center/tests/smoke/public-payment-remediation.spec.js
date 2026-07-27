/* eslint-disable testing-library/prefer-screen-queries */
import { test, expect } from '@playwright/test';

const baseInvoice = {
  id: 'invoice-1',
  invoice_number: 'INV-1001',
  status: 'sent',
  settlement_status: 'unpaid',
  total_amount: 100,
  amount_paid: 0,
  balance_due: 100,
  subtotal: 100,
  tax_amount: 0,
  paid_at: null,
  invoice_items: [],
  customer_name: 'Test Customer',
};

const mockInvoice = async (page, invoice) => {
  await page.route('**/functions/v1/public-invoice*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ invoice }),
    });
  });
};

test('partial invoice remains payable for its exact remaining balance and null checkout URL fails visibly', async ({ page }) => {
  const invoice = {
    ...baseInvoice,
    status: 'partial',
    settlement_status: 'partial',
    amount_paid: 40,
    balance_due: 60,
  };
  await mockInvoice(page, invoice);

  let publicPayCalls = 0;
  await page.route('**/functions/v1/public-pay', async (route) => {
    publicPayCalls += 1;
    const requestBody = JSON.parse(route.request().postData() || '{}');
    expect(requestBody).toEqual({ token: 'partial-token', amount: 60, method: 'card' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, checkout_url: null }),
    });
  });

  await page.goto('/pay/partial-token');
  await expect(page.getByText('Checkout URL unavailable.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay $60.00' })).toBeEnabled();
  await expect(page.getByText('Payment Successful!')).toHaveCount(0);
  expect(publicPayCalls).toBe(1);
});

test('fully paid invoice renders terminal success without invoking public-pay', async ({ page }) => {
  await mockInvoice(page, {
    ...baseInvoice,
    status: 'paid',
    settlement_status: 'paid',
    amount_paid: 100,
    balance_due: 0,
    paid_at: '2026-07-26T12:00:00.000Z',
  });

  let publicPayCalls = 0;
  await page.route('**/functions/v1/public-pay', async (route) => {
    publicPayCalls += 1;
    await route.abort();
  });

  await page.goto('/pay/paid-token');
  await expect(page.getByText('Payment Successful!')).toBeVisible();
  expect(publicPayCalls).toBe(0);
});

test('voided invoice is blocked locally and never invokes public-pay', async ({ page }) => {
  await mockInvoice(page, { ...baseInvoice, status: 'void' });

  let publicPayCalls = 0;
  await page.route('**/functions/v1/public-pay', async (route) => {
    publicPayCalls += 1;
    await route.abort();
  });

  await page.goto('/pay/void-token');
  await expect(page.getByText('This invoice is not available for online payment.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay $100.00' })).toBeDisabled();
  expect(publicPayCalls).toBe(0);
});
