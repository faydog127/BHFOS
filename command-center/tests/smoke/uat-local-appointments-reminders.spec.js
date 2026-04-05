/* eslint-disable testing-library/prefer-screen-queries */
import { test, expect } from '@playwright/test';

import {
  createAdminClient,
  createRunId,
  insertWithRetry,
} from './helpers/supabaseAdmin.js';

const TENANT_ID = 'tvg';

const assertLocalSupabaseEnv = (supabaseUrl) => {
  if (!/127\.0\.0\.1|localhost/i.test(supabaseUrl)) {
    throw new Error(`Refusing to run local appointment UAT against non-local Supabase URL: ${supabaseUrl || '[missing]'}`);
  }
};

const toIsoAt = (dayOffset, hours, minutes = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hours, minutes, 0, 0);
  return value.toISOString();
};

const toLocalInputValue = (isoValue) => {
  const value = new Date(isoValue);
  const pad = (part) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const createLead = async (admin, runId, overrides = {}) => {
  const result = await insertWithRetry(admin, 'leads', {
    tenant_id: TENANT_ID,
    first_name: 'Appointment',
    last_name: `Run${runId.slice(0, 4)}`,
    email: `appointments.${runId}.${Math.random().toString(16).slice(2, 6)}@example.com`,
    phone: '3215551100',
    service: 'Dryer Vent Cleaning',
    source: 'LOCAL_APPOINTMENT_UAT',
    status: 'new',
    stage: 'new',
    persona: 'homeowner',
    is_partner: false,
    ...overrides,
  });

  if (result.error) throw result.error;
  return result.data;
};

const createTechnician = async (admin, runId) => {
  const { data: existing, error: existingError } = await admin
    .from('technicians')
    .select('id, user_id, full_name')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return { record: existing, authUserId: null };

  const email = `appointment.tech.${runId}@example.com`;
  const password = `Tech!${runId}Aa1`;
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      tenant_id: TENANT_ID,
      role: 'technician',
    },
  });
  if (createUserError) throw createUserError;

  const result = await insertWithRetry(admin, 'technicians', {
    user_id: createdUser?.user?.id || null,
    full_name: `Appointment Tech ${runId.slice(0, 4).toUpperCase()}`,
    email,
    is_active: true,
    is_primary_default: true,
  });
  if (result.error) throw result.error;
  return { record: result.data, authUserId: createdUser?.user?.id || null };
};

const getActiveService = async (admin) => {
  const { data, error } = await admin
    .from('price_book')
    .select('id, tenant_id, code, name, category, base_price')
    .eq('active', true)
    .in('tenant_id', ['default', TENANT_ID])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('Missing active price_book row for appointment UAT.');
  return data;
};

const createPendingAppointment = async (admin, payload) => {
  const result = await insertWithRetry(admin, 'appointments', payload);
  if (result.error) throw result.error;
  return result.data;
};

const countAppointmentTasks = async (admin, appointmentId) => {
  const { count, error } = await admin
    .from('crm_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .eq('source_type', 'appointment')
    .eq('source_id', appointmentId);
  if (error) throw error;
  return count || 0;
};

test.describe.serial('UAT LOCAL appointment reminders', () => {
  test('UAT-APPT-001 approves pending appointments and creates confirmed appointments through the UI', async ({ page }) => {
    const runId = createRunId().replace(/-/g, '').slice(0, 8).toLowerCase();
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);

    const email = `appointment.admin.${runId}@example.com`;
    const password = `Appointment!${runId}Aa1`;

    const leadIds = [];
    const appointmentIds = [];
    let authUserId = null;
    let technicianAuthUserId = null;

    try {
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          tenant_id: TENANT_ID,
          role: 'admin',
        },
        user_metadata: {
          role: 'admin',
        },
      });
      if (createUserError) throw createUserError;
      authUserId = createdUser?.user?.id || null;

      const { record: technician, authUserId: createdTechUserId } = await createTechnician(admin, runId);
      technicianAuthUserId = createdTechUserId;
      const service = await getActiveService(admin);

      const pendingLeadName = `Pending${runId.slice(0, 3)}`;
      const pendingLead = await createLead(admin, runId, {
        first_name: 'Ava',
        last_name: pendingLeadName,
      });
      leadIds.push(pendingLead.id);

      const schedulerLeadName = `Scheduler${runId.slice(0, 3)}`;
      const schedulerLead = await createLead(admin, runId, {
        first_name: 'Ben',
        last_name: schedulerLeadName,
      });
      leadIds.push(schedulerLead.id);

      const pendingStart = toIsoAt(4, 13, 0);
      const pendingAppointment = await createPendingAppointment(admin, {
        tenant_id: TENANT_ID,
        lead_id: pendingLead.id,
        technician_id: technician.id,
        price_book_id: service.id,
        service_name: service.name,
        service_category: service.category,
        pricing_snapshot: {
          name: service.name,
          category: service.category,
          price: service.base_price,
        },
        scheduled_start: pendingStart,
        scheduled_end: toIsoAt(4, 14, 30),
        arrival_window_start: pendingStart,
        arrival_window_end: toIsoAt(4, 14, 0),
        duration_minutes: 90,
        status: 'pending',
        service_address: '530 Loxley Ct, Titusville, FL 32780',
        customer_notes: 'Ring the side gate',
      });
      appointmentIds.push(pendingAppointment.id);

      await page.goto('/tvg/login', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: /sign in to tvg/i })).toBeVisible();
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();
      await page.waitForURL(/\/tvg\/crm(\/.*)?$/);

      await page.goto('/tvg/crm/calendar', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();

      const pendingCard = page.locator('div').filter({ hasText: pendingLeadName }).filter({ hasText: service.name }).first();
      await expect(pendingCard).toBeVisible();
      await pendingCard.getByRole('button', { name: 'Approve' }).click();

      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from('appointments')
            .select('status')
            .eq('id', pendingAppointment.id)
            .maybeSingle();

          if (error) throw error;
          return String(data?.status || '').toLowerCase();
        }, { timeout: 20000 })
        .toBe('confirmed');

      await expect
        .poll(async () => countAppointmentTasks(admin, pendingAppointment.id), { timeout: 20000 })
        .toBeGreaterThanOrEqual(2);

      await page.goto('/tvg/crm/calendar', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();

      const customerCombobox = page.getByRole('combobox', { name: 'Customer' });
      await expect(customerCombobox).toBeEnabled({ timeout: 20000 });
      await customerCombobox.click();
      await page.getByPlaceholder('Search customers...').fill(schedulerLeadName);
      const existingCustomerItem = page.locator('[cmdk-item]').filter({ hasText: schedulerLeadName }).first();
      await existingCustomerItem.waitFor();
      await existingCustomerItem.evaluate((node) => node.click());
      await expect(customerCombobox).toContainText(`Ben ${schedulerLeadName}`);

      const newCustomerEmail = `new.customer.${runId}@example.com`;
      const newCustomerLastName = `Fresh${runId.slice(0, 3)}`;
      await page.getByRole('button', { name: /add customer/i }).click();
      await page.getByLabel('First Name').fill('Cora');
      await page.getByLabel('Last Name').fill(newCustomerLastName);
      await page.getByLabel('Email').fill(newCustomerEmail);
      await page.getByLabel('Phone').fill('3215552299');
      await page.getByRole('button', { name: /save customer/i }).click();
      await expect(customerCombobox).toContainText(`Cora ${newCustomerLastName}`);

      const serviceCombobox = page.getByRole('combobox', { name: 'Service' });
      await expect(serviceCombobox).toBeEnabled({ timeout: 20000 });
      await serviceCombobox.click();
      await page.getByPlaceholder('Search by service name, code, or category...').fill(service.name);
      const serviceItem = page.locator('[cmdk-item]').filter({ hasText: service.name }).first();
      await serviceItem.waitFor();
      await serviceItem.evaluate((node) => node.click());
      await expect(serviceCombobox).toContainText(service.name);

      const schedulerStart = toIsoAt(4, 10, 30);
      await page.locator('input[type="datetime-local"]').fill(toLocalInputValue(schedulerStart));
      await expect(page.locator('input[type="datetime-local"]')).toHaveValue(toLocalInputValue(schedulerStart));

      await page.locator('input[type="number"]').fill('90');

      await page.getByRole('combobox', { name: 'Appointment Technician' }).click();
      const technicianOption = page.getByRole('option', { name: technician.full_name }).first();
      await technicianOption.waitFor();
      await technicianOption.evaluate((node) => node.click());

      await page.getByPlaceholder('123 Main St, Titusville, FL 32780').fill('930 Alabama St, Titusville, FL 32796');
      await page.getByPlaceholder('Gate code, parking notes, or prep reminders').fill('Call on arrival');
      await page.getByRole('button', { name: /^book visit$/i }).click();

      await expect
        .poll(async () => {
          const { data: createdLead, error: createdLeadError } = await admin
            .from('leads')
            .select('id')
            .eq('tenant_id', TENANT_ID)
            .eq('email', newCustomerEmail)
            .maybeSingle();

          if (createdLeadError) throw createdLeadError;
          if (!createdLead?.id) return null;

          const { data, error } = await admin
            .from('appointments')
            .select('id, status')
            .eq('tenant_id', TENANT_ID)
            .eq('lead_id', createdLead.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw error;
          return data
            ? {
                id: data.id,
                status: String(data.status || '').toLowerCase(),
              }
            : null;
        }, { timeout: 20000 })
        .toMatchObject({ status: 'confirmed' });

      const { data: createdLead, error: createdLeadError } = await admin
        .from('leads')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .eq('email', newCustomerEmail)
        .maybeSingle();
      if (createdLeadError) throw createdLeadError;
      leadIds.push(createdLead?.id);

      const { data: createdSchedulerAppointment, error: createdSchedulerAppointmentError } = await admin
        .from('appointments')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .eq('lead_id', createdLead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (createdSchedulerAppointmentError) throw createdSchedulerAppointmentError;
      appointmentIds.push(createdSchedulerAppointment?.id);

      await expect
        .poll(async () => countAppointmentTasks(admin, createdSchedulerAppointment.id), { timeout: 20000 })
        .toBeGreaterThanOrEqual(2);
    } finally {
      if (appointmentIds.length) {
        await admin
          .from('crm_tasks')
          .delete()
          .eq('tenant_id', TENANT_ID)
          .eq('source_type', 'appointment')
          .in('source_id', appointmentIds.filter(Boolean));

        await admin
          .from('appointments')
          .delete()
          .eq('tenant_id', TENANT_ID)
          .in('id', appointmentIds.filter(Boolean));
      }

      if (leadIds.length) {
        await admin
          .from('leads')
          .delete()
          .eq('tenant_id', TENANT_ID)
          .in('id', leadIds.filter(Boolean));
      }

      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
      if (technicianAuthUserId) {
        await admin.auth.admin.deleteUser(technicianAuthUserId);
      }
    }
  });
});
