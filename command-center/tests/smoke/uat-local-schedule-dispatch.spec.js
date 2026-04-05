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
    throw new Error(`Refusing to run local schedule UAT against non-local Supabase URL: ${supabaseUrl || '[missing]'}`);
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

const buildWorkOrderNumber = (runId, suffix) => `WO-2026-${runId.slice(0, 4).toUpperCase()}${suffix}`;

const createLead = async (admin, runId, overrides = {}) => {
  const result = await insertWithRetry(
    admin,
    'leads',
    {
      tenant_id: TENANT_ID,
      first_name: 'Dispatch',
      last_name: `Run${runId.slice(0, 4)}`,
      email: `dispatch.${runId}@example.com`,
      phone: '3215551000',
      service: 'Dryer Vent Cleaning',
      source: 'LOCAL_DISPATCH',
      status: 'new',
      stage: 'new',
      ...overrides,
    },
  );

  if (result.error) throw result.error;
  return result.data;
};

const createJob = async (admin, payload) => {
  const result = await insertWithRetry(admin, 'jobs', payload);
  if (result.error) throw result.error;
  return result.data;
};

const createTechnician = async (admin, payload) => {
  const result = await insertWithRetry(admin, 'technicians', payload);
  if (result.error) throw result.error;
  return result.data;
};

const createAuthUser = async (admin, payload) => {
  const { data, error } = await admin.auth.admin.createUser(payload);
  if (error) throw error;
  return data.user;
};

test.describe.serial('UAT LOCAL schedule dispatch board', () => {
  test('UAT-SD-001 renders prioritized queues and schedules triage work locally', async ({ page }) => {
    const runId = createRunId().replace(/-/g, '').slice(0, 8).toLowerCase();
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);

    const email = `dispatch.${runId}@example.com`;
    const password = `Dispatch!${runId}Aa1`;

    const jobIds = [];
    const leadIds = [];
    let authUserId = null;
    let technicianUserId = null;
    let technicianRecordId = null;

    const criticalName = `Alden North${runId.slice(0, 3)}`;
    const atRiskName = `Bria Carter${runId.slice(0, 3)}`;
    const triageName = `Colin Meyer${runId.slice(0, 3)}`;
    const inProgressName = `Dana Hall${runId.slice(0, 3)}`;
    const upcomingName = `Elena Price${runId.slice(0, 3)}`;
    const technicianName = `Dispatch Tech ${runId.slice(0, 4).toUpperCase()}`;

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

      const { data: createdTechnicianUser, error: createTechnicianUserError } = await admin.auth.admin.createUser({
        email: `tech.${runId}@example.com`,
        password: `Tech!${runId}Aa1`,
        email_confirm: true,
        app_metadata: {
          tenant_id: TENANT_ID,
          role: 'technician',
        },
        user_metadata: {
          role: 'technician',
        },
      });
      if (createTechnicianUserError) throw createTechnicianUserError;
      technicianUserId = createdTechnicianUser?.user?.id || null;

      const technicianRecord = await createTechnician(admin, {
        user_id: technicianUserId,
        full_name: technicianName,
        email: `tech.${runId}@example.com`,
        is_active: true,
      });
      technicianRecordId = technicianRecord.id;

      const criticalLead = await createLead(admin, runId, {
        first_name: 'Alden',
        last_name: `North${runId.slice(0, 3)}`,
        email: `alden.${runId}@example.com`,
        phone: '3215551001',
      });
      leadIds.push(criticalLead.id);

      const atRiskLead = await createLead(admin, runId, {
        first_name: 'Bria',
        last_name: `Carter${runId.slice(0, 3)}`,
        email: `bria.${runId}@example.com`,
        phone: '3215551002',
      });
      leadIds.push(atRiskLead.id);

      const triageLead = await createLead(admin, runId, {
        first_name: 'Colin',
        last_name: `Meyer${runId.slice(0, 3)}`,
        email: `colin.${runId}@example.com`,
        phone: '3215551003',
      });
      leadIds.push(triageLead.id);

      const inProgressLead = await createLead(admin, runId, {
        first_name: 'Dana',
        last_name: `Hall${runId.slice(0, 3)}`,
        email: `dana.${runId}@example.com`,
        phone: '3215551004',
      });
      leadIds.push(inProgressLead.id);

      const upcomingLead = await createLead(admin, runId, {
        first_name: 'Elena',
        last_name: `Price${runId.slice(0, 3)}`,
        email: `elena.${runId}@example.com`,
        phone: '3215551005',
      });
      leadIds.push(upcomingLead.id);

      const criticalJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: criticalLead.id,
        status: 'scheduled',
        work_order_number: buildWorkOrderNumber(runId, '01'),
        service_address: '1805 Riverside Dr Unit 502, Titusville, FL 32780',
        payment_status: 'unpaid',
        total_amount: 149,
        scheduled_start: toIsoAt(0, 9, 0),
        scheduled_end: toIsoAt(0, 11, 0),
        created_at: toIsoAt(-1, 8, 0),
        updated_at: toIsoAt(-1, 8, 0),
      });
      jobIds.push(criticalJob.id);

      const atRiskJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: atRiskLead.id,
        status: 'unscheduled',
        work_order_number: buildWorkOrderNumber(runId, '02'),
        service_address: '1825 Riverside Dr Unit 609, Titusville, FL 32780',
        payment_status: 'unpaid',
        total_amount: 99,
        created_at: toIsoAt(-3, 10, 30),
        updated_at: toIsoAt(-3, 10, 30),
      });
      jobIds.push(atRiskJob.id);

      const triageJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: triageLead.id,
        status: 'unscheduled',
        work_order_number: buildWorkOrderNumber(runId, '03'),
        service_address: '930 Alabama St, Titusville, FL 32796',
        payment_status: 'unpaid',
        total_amount: 149,
        created_at: toIsoAt(0, 7, 45),
        updated_at: toIsoAt(0, 7, 45),
      });
      jobIds.push(triageJob.id);

      const inProgressJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: inProgressLead.id,
        status: 'in_progress',
        work_order_number: buildWorkOrderNumber(runId, '04'),
        service_address: '1805 Riverside Dr Unit 503, Titusville, FL 32780',
        payment_status: 'unpaid',
        total_amount: 99,
        scheduled_start: toIsoAt(0, 11, 30),
        scheduled_end: toIsoAt(0, 13, 30),
        created_at: toIsoAt(-1, 14, 0),
        updated_at: toIsoAt(0, 11, 35),
      });
      jobIds.push(inProgressJob.id);

      const upcomingJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: upcomingLead.id,
        status: 'scheduled',
        work_order_number: buildWorkOrderNumber(runId, '05'),
        service_address: '1825 Riverside Dr Unit 610, Titusville, FL 32780',
        payment_status: 'unpaid',
        total_amount: 99,
        scheduled_start: toIsoAt(3, 9, 30),
        scheduled_end: toIsoAt(3, 11, 30),
        created_at: toIsoAt(-1, 9, 0),
        updated_at: toIsoAt(-1, 9, 0),
      });
      jobIds.push(upcomingJob.id);

      await page.goto('/tvg/login', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: /sign in to tvg/i })).toBeVisible();

      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();

      await page.waitForURL(/\/tvg\/crm(\/.*)?$/);
      await page.goto('/tvg/crm/dispatch', { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { name: 'Dispatch', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Needs Action' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Dispatch Console' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Upcoming This Week' })).toBeVisible();

      const criticalCard = page.getByRole('button').filter({ hasText: criticalName }).first();
      await expect(criticalCard).toBeVisible();
      await expect(criticalCard).toContainText('No technician assigned');
      await expect(criticalCard).toContainText('Next: Assign technician');

      const atRiskCard = page.getByRole('button').filter({ hasText: atRiskName }).first();
      await expect(atRiskCard).toBeVisible();
      await expect(atRiskCard).toContainText('Overdue - not scheduled');
      await expect(atRiskCard).toContainText('Next: Schedule job');

      const triageCard = page.getByRole('button').filter({ hasText: triageName }).first();
      await expect(triageCard).toBeVisible();
      await expect(triageCard).toContainText('New unscheduled work');
      await expect(triageCard).toContainText('Next: Review and schedule');

      const todayInProgressCard = page.getByRole('button').filter({ hasText: inProgressName }).first();
      await expect(todayInProgressCard).toBeVisible();

      const upcomingRow = page.getByRole('button').filter({ hasText: upcomingName }).first();
      await expect(upcomingRow).toBeVisible();

      await criticalCard.click();
      await expect(page.getByRole('button', { name: 'Assign Technician', exact: true })).toBeVisible();
      const technicianTrigger = page.locator('#dispatch-technician-select');
      await technicianTrigger.click();
      await page.getByRole('option', { name: technicianName }).click();
      await expect(technicianTrigger).toContainText(technicianName);
      await page.getByRole('button', { name: 'Assign Technician', exact: true }).click();

      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from('jobs')
            .select('technician_id, status')
            .eq('id', criticalJob.id)
            .maybeSingle();

          if (error) throw error;
          return {
            technicianId: data?.technician_id || null,
            status: String(data?.status || '').toLowerCase(),
          };
        }, { timeout: 20000 })
        .toEqual({
          technicianId: technicianUserId,
          status: 'scheduled',
        });

      await page.reload({ waitUntil: 'networkidle' });
      const reassignedCriticalCard = page.getByRole('button').filter({ hasText: criticalName }).first();
      await expect(reassignedCriticalCard).toBeVisible();
      await expect(reassignedCriticalCard).not.toContainText('No technician assigned');
      await expect(reassignedCriticalCard).toContainText(technicianName);

      await todayInProgressCard.click();
      await expect(page.getByRole('button', { name: 'Complete Job', exact: true })).toBeVisible();

      await triageCard.click();
      await expect(page.getByRole('button', { name: 'Schedule Now', exact: true })).toBeVisible();

      const scheduledFuture = toIsoAt(4, 14, 0);
      const dispatchStartInput = page.getByLabel('Dispatch Service Date Time');
      const localScheduleValue = toLocalInputValue(scheduledFuture);
      await dispatchStartInput.fill(localScheduleValue);
      await expect(dispatchStartInput).toHaveValue(localScheduleValue);
      await dispatchStartInput.blur();
      await technicianTrigger.click();
      await page.getByRole('option', { name: technicianName }).click();
      await expect(technicianTrigger).toContainText(technicianName);
      await page.getByRole('button', { name: 'Schedule Now', exact: true }).click();

      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from('jobs')
            .select('status, scheduled_start, technician_id')
            .eq('id', triageJob.id)
            .maybeSingle();

          if (error) throw error;
          return {
            status: String(data?.status || '').toLowerCase(),
            hasSchedule: Boolean(data?.scheduled_start),
            technicianId: data?.technician_id || null,
          };
        }, { timeout: 20000 })
        .toEqual({ status: 'scheduled', hasSchedule: true, technicianId: technicianUserId });

      await expect(
        page
          .getByRole('button')
          .filter({ hasText: triageName })
          .filter({ hasText: 'New unscheduled work' }),
      ).toHaveCount(0);

      const upcomingScheduledRow = page.getByRole('button').filter({ hasText: triageName }).first();
      await expect(upcomingScheduledRow).toBeVisible();
    } finally {
      if (jobIds.length > 0) {
        await admin.from('jobs').delete().in('id', jobIds);
      }

      if (leadIds.length > 0) {
        await admin.from('leads').delete().in('id', leadIds);
      }

      if (technicianRecordId) {
        await admin.from('technicians').delete().eq('id', technicianRecordId);
      }

      if (technicianUserId) {
        await admin.auth.admin.deleteUser(technicianUserId);
      }

      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });

  test('UAT-SD-002 blocks overlap conflicts and stale writes locally', async ({ page }) => {
    const runId = createRunId().replace(/-/g, '').slice(0, 8).toLowerCase();
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);

    const email = `dispatch.${runId}@example.com`;
    const password = `Dispatch!${runId}Aa1`;

    const jobIds = [];
    const leadIds = [];
    let authUserId = null;
    let technicianUserId = null;
    let technicianRecordId = null;

    const overlapName = `Farah Quinn${runId.slice(0, 3)}`;
    const staleName = `Gavin Moore${runId.slice(0, 3)}`;
    const technicianName = `Dispatch Tech ${runId.slice(0, 4).toUpperCase()}`;

    try {
      const loginUser = await createAuthUser(admin, {
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
      authUserId = loginUser.id;

      const technicianUser = await createAuthUser(admin, {
        email: `tech.${runId}@example.com`,
        password: `Tech!${runId}Aa1`,
        email_confirm: true,
        app_metadata: {
          tenant_id: TENANT_ID,
          role: 'technician',
        },
        user_metadata: {
          role: 'technician',
        },
      });
      technicianUserId = technicianUser.id;

      const technicianRecord = await createTechnician(admin, {
        user_id: technicianUserId,
        full_name: technicianName,
        email: `tech.${runId}@example.com`,
        is_active: true,
      });
      technicianRecordId = technicianRecord.id;

      const scheduledLead = await createLead(admin, runId, {
        first_name: 'Existing',
        last_name: `Overlap${runId.slice(0, 3)}`,
        email: `existing.${runId}@example.com`,
        phone: '3215552001',
      });
      leadIds.push(scheduledLead.id);

      const overlapLead = await createLead(admin, runId, {
        first_name: 'Farah',
        last_name: `Quinn${runId.slice(0, 3)}`,
        email: `farah.${runId}@example.com`,
        phone: '3215552002',
      });
      leadIds.push(overlapLead.id);

      const staleLead = await createLead(admin, runId, {
        first_name: 'Gavin',
        last_name: `Moore${runId.slice(0, 3)}`,
        email: `gavin.${runId}@example.com`,
        phone: '3215552003',
      });
      leadIds.push(staleLead.id);

      const existingJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: scheduledLead.id,
        status: 'scheduled',
        work_order_number: buildWorkOrderNumber(runId, '11'),
        service_address: '100 Conflict Ave, Titusville, FL 32780',
        payment_status: 'unpaid',
        total_amount: 149,
        technician_id: technicianUserId,
        scheduled_start: toIsoAt(1, 9, 0),
        scheduled_end: toIsoAt(1, 11, 0),
        created_at: toIsoAt(-1, 8, 0),
        updated_at: toIsoAt(-1, 8, 0),
      });
      jobIds.push(existingJob.id);

      const overlapJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: overlapLead.id,
        status: 'unscheduled',
        work_order_number: buildWorkOrderNumber(runId, '12'),
        service_address: '101 Conflict Ave, Titusville, FL 32780',
        payment_status: 'unpaid',
        total_amount: 149,
        created_at: toIsoAt(0, 9, 30),
        updated_at: toIsoAt(0, 9, 30),
      });
      jobIds.push(overlapJob.id);

      const staleJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: staleLead.id,
        status: 'scheduled',
        work_order_number: buildWorkOrderNumber(runId, '13'),
        service_address: '102 Conflict Ave, Titusville, FL 32780',
        payment_status: 'unpaid',
        total_amount: 99,
        scheduled_start: toIsoAt(1, 13, 0),
        scheduled_end: toIsoAt(1, 15, 0),
        created_at: toIsoAt(-1, 10, 0),
        updated_at: toIsoAt(-1, 10, 0),
      });
      jobIds.push(staleJob.id);

      await page.goto('/tvg/login', { waitUntil: 'networkidle' });
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();
      await page.waitForURL(/\/tvg\/crm(\/.*)?$/);

      await page.goto('/tvg/crm/dispatch', { waitUntil: 'networkidle' });

      const technicianTrigger = page.locator('#dispatch-technician-select');
      const dispatchStartInput = page.getByLabel('Dispatch Service Date Time');

      const overlapCard = page.getByRole('button').filter({ hasText: overlapName }).first();
      await expect(overlapCard).toBeVisible();
      await overlapCard.click();
      await dispatchStartInput.fill(toLocalInputValue(toIsoAt(1, 10, 0)));
      await technicianTrigger.click();
      await page.getByRole('option', { name: technicianName }).click();
      await expect(technicianTrigger).toContainText(technicianName);
      await page.getByRole('button', { name: 'Schedule Now', exact: true }).click();

      await expect(page.getByText(/Scheduling conflict with/i).first()).toBeVisible({ timeout: 10000 });
      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from('jobs')
            .select('status, technician_id, scheduled_start')
            .eq('id', overlapJob.id)
            .maybeSingle();
          if (error) throw error;
          return {
            status: String(data?.status || '').toLowerCase(),
            technicianId: data?.technician_id || null,
            scheduledStart: data?.scheduled_start || null,
          };
        }, { timeout: 10000 })
        .toEqual({
          status: 'unscheduled',
          technicianId: null,
          scheduledStart: null,
        });

      const staleCard = page.getByRole('button').filter({ hasText: staleName }).first();
      await expect(staleCard).toBeVisible();
      await staleCard.click();

      await admin
        .from('jobs')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', staleJob.id);

      await technicianTrigger.click();
      await page.getByRole('option', { name: technicianName }).click();
      await expect(technicianTrigger).toContainText(technicianName);
      await page.getByRole('button', { name: 'Assign Technician', exact: true }).click();

      await expect(page.getByText(/changed in another session/i).first()).toBeVisible({ timeout: 10000 });
      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from('jobs')
            .select('technician_id')
            .eq('id', staleJob.id)
            .maybeSingle();
          if (error) throw error;
          return data?.technician_id || null;
        }, { timeout: 10000 })
        .toBeNull();
    } finally {
      if (jobIds.length > 0) {
        await admin.from('jobs').delete().in('id', jobIds);
      }

      if (leadIds.length > 0) {
        await admin.from('leads').delete().in('id', leadIds);
      }

      if (technicianRecordId) {
        await admin.from('technicians').delete().eq('id', technicianRecordId);
      }

      if (technicianUserId) {
        await admin.auth.admin.deleteUser(technicianUserId);
      }

      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });

  test('UAT-SD-003 blocks incomplete addresses and allows dispatchable addresses locally', async ({ page }) => {
    const runId = createRunId().replace(/-/g, '').slice(0, 8).toLowerCase();
    const { client: admin, env } = createAdminClient();
    assertLocalSupabaseEnv(env.supabaseUrl);

    const email = `dispatch.${runId}@example.com`;
    const password = `Dispatch!${runId}Aa1`;

    const jobIds = [];
    const leadIds = [];
    let authUserId = null;
    let technicianUserId = null;
    let technicianRecordId = null;

    const triageName = `Holly Price${runId.slice(0, 3)}`;
    const technicianName = `Dispatch Tech ${runId.slice(0, 4).toUpperCase()}`;

    try {
      const loginUser = await createAuthUser(admin, {
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
      authUserId = loginUser.id;

      const technicianUser = await createAuthUser(admin, {
        email: `tech.${runId}@example.com`,
        password: `Tech!${runId}Aa1`,
        email_confirm: true,
        app_metadata: {
          tenant_id: TENANT_ID,
          role: 'technician',
        },
        user_metadata: {
          role: 'technician',
        },
      });
      technicianUserId = technicianUser.id;

      const technicianRecord = await createTechnician(admin, {
        user_id: technicianUserId,
        full_name: technicianName,
        email: `tech.${runId}@example.com`,
        is_active: true,
      });
      technicianRecordId = technicianRecord.id;

      const triageLead = await createLead(admin, runId, {
        first_name: 'Holly',
        last_name: `Price${runId.slice(0, 3)}`,
        email: `holly.${runId}@example.com`,
        phone: '3215553001',
      });
      leadIds.push(triageLead.id);

      const triageJob = await createJob(admin, {
        tenant_id: TENANT_ID,
        lead_id: triageLead.id,
        status: 'unscheduled',
        work_order_number: buildWorkOrderNumber(runId, '21'),
        service_address: '',
        payment_status: 'unpaid',
        total_amount: 149,
        created_at: toIsoAt(0, 8, 0),
        updated_at: toIsoAt(0, 8, 0),
      });
      jobIds.push(triageJob.id);

      await page.goto('/tvg/login', { waitUntil: 'networkidle' });
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();
      await page.waitForURL(/\/tvg\/crm(\/.*)?$/);

      await page.goto('/tvg/crm/dispatch', { waitUntil: 'networkidle' });

      const triageCard = page.getByRole('button').filter({ hasText: triageName }).first();
      await expect(triageCard).toBeVisible();
      await triageCard.click();

      const technicianTrigger = page.locator('#dispatch-technician-select');
      const dispatchStartInput = page.getByLabel('Dispatch Service Date Time');
      const dispatchAddressInput = page.locator('input[name="dispatch_service_address"]');

      await dispatchStartInput.fill(toLocalInputValue(toIsoAt(2, 10, 0)));
      await technicianTrigger.click();
      await page.getByRole('option', { name: technicianName }).click();
      await expect(technicianTrigger).toContainText(technicianName);

      await dispatchAddressInput.fill('930 Alabama St');
      await page.getByRole('button', { name: 'Schedule Now', exact: true }).click();

      await expect(page.getByText(/dispatchable address with street, city, and state/i).first()).toBeVisible({ timeout: 10000 });
      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from('jobs')
            .select('status, service_address, scheduled_start, technician_id')
            .eq('id', triageJob.id)
            .maybeSingle();
          if (error) throw error;
          return {
            status: String(data?.status || '').toLowerCase(),
            serviceAddress: data?.service_address || null,
            scheduledStart: data?.scheduled_start || null,
            technicianId: data?.technician_id || null,
          };
        }, { timeout: 10000 })
        .toEqual({
          status: 'unscheduled',
          serviceAddress: null,
          scheduledStart: null,
          technicianId: null,
        });

      await dispatchAddressInput.fill('930 Alabama St, Titusville, FL 32796');
      await page.getByRole('button', { name: 'Schedule Now', exact: true }).click();

      await expect
        .poll(async () => {
          const { data, error } = await admin
            .from('jobs')
            .select('status, service_address, scheduled_start, technician_id')
            .eq('id', triageJob.id)
            .maybeSingle();
          if (error) throw error;
          return {
            status: String(data?.status || '').toLowerCase(),
            serviceAddress: data?.service_address || null,
            hasScheduledStart: Boolean(data?.scheduled_start),
            technicianId: data?.technician_id || null,
          };
        }, { timeout: 20000 })
        .toEqual({
          status: 'scheduled',
          serviceAddress: '930 Alabama St, Titusville, FL 32796',
          hasScheduledStart: true,
          technicianId: technicianUserId,
        });
    } finally {
      if (jobIds.length > 0) {
        await admin.from('jobs').delete().in('id', jobIds);
      }

      if (leadIds.length > 0) {
        await admin.from('leads').delete().in('id', leadIds);
      }

      if (technicianRecordId) {
        await admin.from('technicians').delete().eq('id', technicianRecordId);
      }

      if (technicianUserId) {
        await admin.auth.admin.deleteUser(technicianUserId);
      }

      if (authUserId) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }
  });
});
