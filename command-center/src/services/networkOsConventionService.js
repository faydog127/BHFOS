/**
 * Network OS convention-demo data service.
 *
 * Existing hosted objects only. Customer-bearing reads require session tenant
 * plus is_test_data=true at query time. Related org/account/property/event/task
 * rows are fetched by those demo IDs only. Writes stay gated.
 */

import {
  CONVENTION_READ_FAILED,
  DEMO_WRITE_ISOLATION_BLOCKED,
  assertDemoWriteAllowed,
  createConventionPolicy,
  describeConventionTenant,
  evaluateDemoWrite,
  keepDemoCustomerRows,
  resolveConventionTenant,
  sanitizeConventionError,
  uniqueIds,
} from '../lib/networkOs/conventionDemoPolicy.js';

export const CONVENTION_LEAD_COLUMNS =
  'id, tenant_id, is_test_data, first_name, last_name, company, status, source, pipeline_stage, qualification_status, account_id, property_id, contact_id, created_at';

export const CONVENTION_CONTACT_COLUMNS =
  'id, tenant_id, is_test_data, first_name, last_name, role, contact_status, is_active, organization_id, account_id, property_id, lead_id, created_at';

export const CONVENTION_ACCOUNT_COLUMNS = 'id, type, partner_status, is_test_data';
export const CONVENTION_ORGANIZATION_COLUMNS = 'id, type, is_partner';
export const CONVENTION_PROPERTY_COLUMNS = 'id, is_active, in_ao';
export const CONVENTION_CATALOG_COLUMNS = 'id, slug, is_active';
export const CONVENTION_TASK_COLUMNS =
  'id, tenant_id, status, source_type, type, priority, title';
export const CONVENTION_EVENT_COLUMNS =
  'id, tenant_id, entity_type, event_type, actor_type';

const LIST_LIMIT = 50;

function readFailed(table) {
  const err = new Error(CONVENTION_READ_FAILED);
  err.code = CONVENTION_READ_FAILED;
  err.table = table;
  return err;
}

async function runQuery(builder) {
  return builder;
}

function emptySection(error = null) {
  return {
    rows: [],
    error: error ? sanitizeConventionError(error) : null,
  };
}

/**
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {object} [deps.policy]
 */
export function createNetworkOsConventionService(deps) {
  const supabase = deps?.supabase;
  if (!supabase) throw new Error('networkOsConventionService requires supabase');
  const policy = deps.policy || createConventionPolicy();

  async function selectScoped(table, columns, apply) {
    let query = supabase.from(table).select(columns);
    if (apply) query = apply(query);
    const { data, error } = await runQuery(query);
    if (error) throw readFailed(table);
    return Array.isArray(data) ? data : [];
  }

  async function selectOptional(table, columns, apply) {
    try {
      const rows = await selectScoped(table, columns, apply);
      return { rows, error: null };
    } catch (error) {
      return emptySection(error);
    }
  }

  function requireTenant(tenantCtx) {
    return resolveConventionTenant(tenantCtx);
  }

  async function loadLeads(tenantId) {
    const rows = await selectScoped('leads', CONVENTION_LEAD_COLUMNS, (query) =>
      query
        .eq('tenant_id', tenantId)
        .eq('is_test_data', true)
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT),
    );
    return keepDemoCustomerRows(rows).filter((row) => row.tenant_id === tenantId);
  }

  async function loadContacts(tenantId) {
    const rows = await selectScoped('contacts', CONVENTION_CONTACT_COLUMNS, (query) =>
      query
        .eq('tenant_id', tenantId)
        .eq('is_test_data', true)
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT),
    );
    return keepDemoCustomerRows(rows).filter((row) => row.tenant_id === tenantId);
  }

  async function loadRelatedByIds(table, columns, ids, extraApply) {
    if (!ids.length) return emptySection();
    return selectOptional(table, columns, (query) => {
      let next = query.in('id', ids).limit(LIST_LIMIT);
      if (extraApply) next = extraApply(next);
      return next;
    });
  }

  async function loadWorkspace(tenantCtx) {
    const tenantId = requireTenant(tenantCtx);
    const tenant = describeConventionTenant(tenantId, policy);
    const write = evaluateDemoWrite(tenantCtx, policy);

    const sections = {
      leads: emptySection(),
      contacts: emptySection(),
      organizations: emptySection(),
      accounts: emptySection(),
      properties: emptySection(),
      catalog: emptySection(),
      tasks: emptySection(),
      events: emptySection(),
    };

    try {
      sections.leads = { rows: await loadLeads(tenantId), error: null };
    } catch (error) {
      sections.leads = emptySection(error);
    }

    try {
      sections.contacts = { rows: await loadContacts(tenantId), error: null };
    } catch (error) {
      sections.contacts = emptySection(error);
    }

    const demoRows = [...sections.leads.rows, ...sections.contacts.rows];
    const organizationIds = uniqueIds(sections.contacts.rows, 'organization_id');
    const accountIds = uniqueIds(demoRows, 'account_id');
    const propertyIds = uniqueIds(demoRows, 'property_id');
    const entityIds = uniqueIds(demoRows, 'id');

    sections.organizations = await loadRelatedByIds(
      'organizations',
      CONVENTION_ORGANIZATION_COLUMNS,
      organizationIds,
    );

    sections.accounts = await loadRelatedByIds(
      'accounts',
      CONVENTION_ACCOUNT_COLUMNS,
      accountIds,
      (query) => query.eq('is_test_data', true),
    );
    if (!sections.accounts.error) {
      sections.accounts = {
        rows: keepDemoCustomerRows(sections.accounts.rows),
        error: null,
      };
    }

    sections.properties = await loadRelatedByIds(
      'properties',
      CONVENTION_PROPERTY_COLUMNS,
      propertyIds,
    );

    sections.catalog = await selectOptional(
      'services_catalog',
      CONVENTION_CATALOG_COLUMNS,
      (query) => query.eq('is_active', true).limit(LIST_LIMIT),
    );
    if (!sections.catalog.error) {
      sections.catalog = {
        rows: sections.catalog.rows.filter((row) => row && row.is_active === true),
        error: null,
      };
    }

    if (entityIds.length) {
      sections.tasks = await selectOptional(
        'crm_tasks',
        CONVENTION_TASK_COLUMNS,
        (query) =>
          query
            .eq('tenant_id', tenantId)
            .in('lead_id', entityIds)
            .limit(LIST_LIMIT),
      );
      if (!sections.tasks.error) {
        sections.tasks = {
          rows: sections.tasks.rows.filter((row) => row && row.tenant_id === tenantId),
          error: null,
        };
      }
    }

    if (entityIds.length) {
      sections.events = await selectOptional(
        'events',
        CONVENTION_EVENT_COLUMNS,
        (query) =>
          query
            .eq('tenant_id', tenantId)
            .in('entity_id', entityIds)
            .limit(LIST_LIMIT),
      );
      if (!sections.events.error) {
        sections.events = {
          rows: sections.events.rows.filter((row) => row && row.tenant_id === tenantId),
          error: null,
        };
      }
    }

    return {
      tenant,
      write,
      ...sections,
    };
  }

  async function createDemoLead(input, tenantCtx) {
    try {
      const tenantId = assertDemoWriteAllowed(tenantCtx, policy);
      const payload = {
        tenant_id: tenantId,
        is_test_data: true,
        status: input?.status || 'new',
        first_name: input?.first_name || null,
        last_name: input?.last_name || null,
        company: input?.company || null,
      };
      const { error } = await supabase.from('leads').insert(payload);
      if (error) throw readFailed('leads');
      return { ok: true, tenantId };
    } catch (error) {
      return {
        ok: false,
        code: error?.code || DEMO_WRITE_ISOLATION_BLOCKED,
        error: sanitizeConventionError(error),
      };
    }
  }

  async function updateDemoLead(id, patch, tenantCtx) {
    try {
      const tenantId = assertDemoWriteAllowed(tenantCtx, policy);
      if (!id) throw readFailed('leads');
      const { error } = await supabase
        .from('leads')
        .update({
          status: patch?.status,
          company: patch?.company,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('is_test_data', true);
      if (error) throw readFailed('leads');
      return { ok: true, tenantId };
    } catch (error) {
      return {
        ok: false,
        code: error?.code || DEMO_WRITE_ISOLATION_BLOCKED,
        error: sanitizeConventionError(error),
      };
    }
  }

  return {
    loadWorkspace,
    createDemoLead,
    updateDemoLead,
    policy,
  };
}
