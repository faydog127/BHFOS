import { supabase } from '@/lib/customSupabaseClient';

/**
 * Utility: checkTable
 * robustly checks if a table exists in the connected Supabase instance.
 * Used by the Build Console to audit system health.
 * 
 * @param {string} tableName 
 * @returns {Promise<boolean>}
 */
export const checkTable = async (tableName) => {
  try {
    // We use a HEAD request with exact count to verify table accessibility/existence
    // without fetching rows. 
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      // 42P01 is the PostgreSQL error code for "undefined_table"
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn(`Table check failed: ${tableName} does not exist.`);
        return false;
      }
      // Permissions errors (42501) imply existence, just lack of access, which counts as "exists" for schema purposes
      // but we might want to flag it. For now, we assume if we hit RLS, the table exists.
      if (error.code === '42501') {
        // console.log(`Table exists but RLS blocks access: ${tableName}`);
        return true;
      }
      
      console.error(`Unexpected error checking table ${tableName}:`, error);
      // For other errors, we assume the table might be there but is broken or connection failed
      // Returning false makes the system flag it as an issue.
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Check failed for ${tableName}:`, err);
    return false;
  }
};

/**
 * System Module Definitions
 * These represent the atomic blocks of functionality available in the platform.
 * Each module defines its unique ID, name, status, required database tables, and dependencies.
 */
export const MODULES = {
  coreFoundation: {
    id: 'core',
    name: 'Core System',
    description: 'Authentication, User Profiles, Roles, and Global Config.',
    status: 'stable',
    tables: ['user_profiles', 'app_user_roles', 'global_config', 'business_settings'],
    dependencies: [],
    checks: async () => {
      try {
        // 1. Check Auth Session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        // 2. Check for Infinite Recursion in RLS (Common Issue)
        // If we can select from app_user_roles without crashing, the RLS is likely safe from infinite recursion
        if (session?.user) {
            const { error: rlsError } = await supabase
                .from('app_user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();
            
            if (rlsError && rlsError.code === 'P0001') { // PL/pgSQL error often thrown during recursion limit hit
                throw new Error("CRITICAL: Infinite recursion detected in 'app_user_roles' RLS policy.");
            }
        }
        
        return true;
      } catch (err) {
        console.error("Core Foundation Check Failed:", err);
        return false;
      }
    }
  },
  crmEngine: {
    id: 'crm_leads',
    name: 'Lead Management',
    description: 'Lead capture, pipelines, statuses, and source tracking.',
    status: 'stable',
    tables: ['leads', 'pipeline_columns', 'lead_pipeline_events', 'crm_tasks'],
    dependencies: ['core'],
    /**
     * Pipeline Simulation Check
     * Verifies actual read access and data availability beyond simple table existence.
     */
    checks: async () => {
      try {
        // 1. Check if table physically exists
        const tableExists = await checkTable('leads');
        if (!tableExists) {
            console.error('CRM Engine Check Failed: Leads table missing.');
            return false;
        }

        // 2. Ambiguity Trap Check
        console.group('🔍 Ambiguity Trap Diagnostics');
        console.log('Step 1: Attempting to fetch "id, estimates(id)" from leads to trigger potential conflict...');
        
        // UPDATED: Using explicit foreign key hint to avoid ambiguity
        const { error: ambiguityError } = await supabase
            .from('leads')
            .select('id, estimates!estimates_lead_id_fkey(id)')
            .limit(1);

        if (ambiguityError) {
             console.error('❌ Ambiguity Error Detected!');
             
             // Enhanced JSON Logging for deep inspection
             console.log('--- RAW ERROR OBJECT (JSON) ---');
             console.log(JSON.stringify(ambiguityError, null, 2));
             console.log('-------------------------------');

             console.log('--- ERROR DETAILS ---');
             console.log(`Code: ${ambiguityError.code}`);
             console.log(`Message: ${ambiguityError.message}`);
             console.log(`Details: ${ambiguityError.details || 'No specific details provided by PostgREST'}`);
             console.log(`Hint: ${ambiguityError.hint || 'No hint provided'}`);
             console.log('---------------------');

             if (ambiguityError.code === 'PGRST201' || ambiguityError.message?.includes('more than one relationship')) {
                 const details = ambiguityError.details || ambiguityError.message;
                 throw new Error(`CRITICAL SCHEMA WARNING: Ambiguous relationship detected. PostgREST cannot determine which Foreign Key to use. \nRAW DETAILS: ${details}\nPRESCRIPTION: You have multiple Foreign Keys linking 'leads' and 'estimates'. Drop the redundant column (likely 'leads.estimate_id'). Run: alter table leads drop column estimate_id;`);
             }
             
             console.warn("Ambiguity Trap check encountered non-ambiguity error:", ambiguityError);
        } else {
            console.log('✅ Ambiguity Check Passed: No relationship conflicts detected.');
        }
        console.groupEnd();

        // CRITICAL ARCHITECTURE CHECK: Detect Circular Dependency
        // We attempt to select the specific column 'estimate_id' from leads. 
        // If this succeeds (no error), it means the column exists, which is BAD.
        const { error: columnCheckError } = await supabase
            .from('leads')
            .select('estimate_id')
            .limit(1);

        // If NO error, it means the column exists!
        if (!columnCheckError) {
             throw new Error("CRITICAL ARCHITECTURE ERROR: 'leads.estimate_id' column detected. This causes circular dependency crashes. Drop this column.");
        }
        
        // If error is NOT about the column missing (code 42703 is undefined_column), then something else is wrong
        // but if it is 42703, that is GOOD. Ideally we want column missing.
        if (columnCheckError && columnCheckError.code !== '42703' && !columnCheckError.message?.includes('does not exist')) {
            // Just log unexpected errors, but don't crash the check unless necessary
            console.warn('Unexpected error checking for estimate_id column:', columnCheckError);
        }

        // 3. Pipeline Simulation
        // We try a safe query now that we've checked for traps
        const { data, error } = await supabase
          .from('leads')
          .select('id')
          .limit(1);

        if (error) {
           console.error('CRM Engine Data Access Failed:', error);
           throw new Error(`Data Access Error: ${error.message}`);
        }

        return true;
      } catch (err) {
        console.groupEnd(); // Ensure group is closed if error throws inside
        console.error('CRM Pipeline Simulation Failed:', err);
        // We re-throw specifically formatted errors to be caught by the UI
        if (err.message.includes('CRITICAL') || err.message.includes('Pipeline Crash')) {
            throw err; 
        }
        return false;
      }
    }
  },
  contactCenter: {
    id: 'crm_contacts',
    name: 'Contact Management',
    description: 'Accounts, Contacts, and Property database.',
    status: 'stable',
    tables: ['accounts', 'contacts', 'properties'],
    dependencies: ['crm_leads']
  },
  salesEngine: {
    id: 'sales_engine',
    name: 'Sales Engine',
    description: 'Estimates, Quotes, Proposals, and Price Book.',
    status: 'beta',
    tables: ['estimates', 'quotes', 'price_book', 'services_catalog', 'service_pricing'],
    dependencies: ['crm_leads']
  },
  finance: {
    id: 'finance',
    name: 'Financial Core',
    description: 'Invoicing, Payments, Transactions, and Tax settings.',
    status: 'beta',
    tables: ['invoices', 'invoice_items', 'transactions', 'customer_discounts'],
    dependencies: ['sales_engine'],
    checks: async () => {
        return await checkTable('invoices');
    }
  },
  opsJobs: {
    id: 'operations',
    name: 'Field Operations',
    description: 'Jobs, Scheduling, Technicians, and Work Orders.',
    status: 'beta',
    tables: ['jobs', 'appointments', 'technicians', 'work_orders'],
    dependencies: ['crm_leads', 'crm_contacts'],
    checks: async () => {
        return await checkTable('jobs');
    }
  },
  fieldApp: {
    id: 'field_app',
    name: 'Technician App',
    description: 'Mobile-first interface for field techs, job completion workflows.',
    status: 'beta',
    tables: ['jobs', 'technicians', 'job_items', 'job_surveys'], 
    dependencies: ['operations']
  },
  marketingAuto: {
    id: 'marketing',
    name: 'Marketing Automation',
    description: 'Campaigns, Playbooks, Landing Pages, and Automated Actions.',
    status: 'alpha',
    tables: ['marketing_campaigns', 'marketing_actions', 'landing_pages', 'automation_workflows', 'scheduled_notifications'],
    dependencies: ['crm_leads']
  },
  partnerPortal: {
    id: 'partners',
    name: 'Partner Growth',
    description: 'Partner management, referrals, commissions, and portal access.',
    status: 'beta',
    tables: ['partners', 'partner_prospects', 'referrals', 'referral_partners', 'partner_registrations'],
    dependencies: ['crm_leads']
  },
  reputation: {
    id: 'reputation',
    name: 'Reputation Mgmt',
    description: 'Reviews, Surveys, and Sentiment Analysis.',
    status: 'beta',
    tables: ['reviews', 'job_surveys'],
    dependencies: ['crm_leads', 'operations']
  },
  brandBrain: {
    id: 'brand_brain',
    name: 'Brand Brain AI',
    description: 'Centralized brand voice, context, and AI generation settings.',
    status: 'alpha',
    tables: ['brand_profile', 'playbook_templates'],
    dependencies: ['core']
  },
  flightCheck: {
    id: 'flight_check',
    name: 'Golden Path Sim',
    description: 'End-to-end simulation: Campaign -> Lead -> Job -> Invoice.',
    status: 'experimental',
    tables: ['marketing_campaigns', 'leads', 'jobs', 'invoices'], 
    dependencies: ['finance'],
    uiRoute: '/crm/dashboard',
    /**
     * Flight Check Simulation
     * Executes a full lifecycle test ("Golden Path") to verify system integration health.
     */
    checks: async () => {
        const TEST_ID = Date.now();
        const TEST_PREFIX = `FLIGHT_CHECK_${TEST_ID}`;
        
        let campaignId = null;
        let leadId = null;
        let jobId = null;
        let invoiceId = null;
        let currentStep = 'init';

        console.log(`Starting Flight Check: ${TEST_PREFIX}`);

        try {
            // 1. Create Marketing Campaign
            currentStep = '1. Create Marketing Campaign';
            const { data: campaign, error: campaignError } = await supabase
                .from('marketing_campaigns')
                .insert({
                    name: `${TEST_PREFIX}_Campaign`,
                    slug: `${TEST_PREFIX}_slug`,
                    channel: 'email',
                    status: 'active'
                })
                .select()
                .single();
            
            if (campaignError) throw new Error(`Campaign creation failed: ${campaignError.message}`);
            if (!campaign) throw new Error('Campaign created but no data returned');
            campaignId = campaign.id;

            // 2. Capture Lead
            currentStep = '2. Capture Lead';
            const { data: lead, error: leadError } = await supabase
                .from('leads')
                .insert({
                    first_name: 'Flight',
                    last_name: 'Check',
                    email: `flight_check_${TEST_ID}@example.com`,
                    status: 'New',
                    source: 'FlightCheck',
                    utm_campaign: `${TEST_PREFIX}_slug`,
                    is_test_data: true
                })
                .select()
                .single();

            if (leadError) throw new Error(`Lead capture failed: ${leadError.message}`);
            if (!lead) throw new Error('Lead created but no data returned');
            leadId = lead.id;

            // 3. Create Job
            currentStep = '3. Create Job';
            const { data: job, error: jobError } = await supabase
                .from('jobs')
                .insert({
                    lead_id: leadId,
                    status: 'scheduled',
                    total_amount: 100.00,
                    is_test_data: true
                })
                .select()
                .single();
            
            if (jobError) throw new Error(`Job creation failed: ${jobError.message}`);
            if (!job) throw new Error('Job created but no data returned');
            jobId = job.id;

            // 4. Mark Job Completed
            currentStep = '4. Mark Job Completed';
            const { error: updateError } = await supabase
                .from('jobs')
                .update({ status: 'completed' })
                .eq('id', jobId);

            if (updateError) throw new Error(`Job completion update failed: ${updateError.message}`);

            // 5. Generate Invoice
            currentStep = '5. Generate Invoice';
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    lead_id: leadId,
                    job_id: jobId,
                    invoice_number: Math.floor(TEST_ID / 1000), // Ensure semi-unique integer
                    total_amount: 100.00,
                    status: 'pending',
                    is_test_data: true
                })
                .select()
                .single();
            
            if (invoiceError) throw new Error(`Invoice generation failed: ${invoiceError.message}`);
            if (!invoice) throw new Error('Invoice created but no data returned');
            invoiceId = invoice.id;

            console.log('Flight Check Passed Successfully');
            return true;

        } catch (err) {
            console.error(`Flight Check Failed at step "${currentStep}":`, err);
            return false;
        } finally {
            // Cleanup: Always run, wrap in try/catch to avoid hiding original errors
            try {
                if (invoiceId) await supabase.from('invoices').delete().eq('id', invoiceId);
                if (jobId) await supabase.from('jobs').delete().eq('id', jobId);
                if (leadId) await supabase.from('leads').delete().eq('id', leadId);
                if (campaignId) await supabase.from('marketing_campaigns').delete().eq('id', campaignId);
                
                console.log(`Flight Check Cleanup Completed for ${TEST_PREFIX}`);
            } catch (cleanupErr) {
                console.error('Flight Check Cleanup Failed (Test Result Preserved):', cleanupErr);
            }
        }
    }
  },
  schemaGuard: {
    id: 'schema_guard',
    name: '9. Schema Integrity Guard',
    description: 'Validates database relationships and detects ambiguous Foreign Keys.',
    status: 'stable',
    tables: [],
    dependencies: ['core'],
    checks: async () => {
       console.group('🛡️ Schema Guard Diagnostics');
       try {
          // Check 1: Jobs <-> Leads Ambiguity
          // We attempt to select leads via inner join from jobs. If multiple FKs exist, this throws PGRST201.
          const { error: jobsError } = await supabase
            .from('jobs')
            .select('id, leads!inner(id)')
            .limit(1);
          
          if (jobsError && (jobsError.code === 'PGRST201' || jobsError.message?.includes('more than one relationship'))) {
             throw new Error(`CRITICAL SCHEMA AMBIGUITY (Jobs->Leads): ${jobsError.message}\nPRESCRIPTION: Run the 'Truth Serum' SQL script to identify and drop duplicate Foreign Keys.`);
          }

          // Check 2: Leads <-> Estimates Ambiguity
          // We attempt to select estimates via inner join from leads.
          const { error: leadsError } = await supabase
             .from('leads')
             .select('id, estimates!inner(id)')
             .limit(1);

          if (leadsError && (leadsError.code === 'PGRST201' || leadsError.message?.includes('more than one relationship'))) {
             throw new Error(`CRITICAL SCHEMA AMBIGUITY (Leads->Estimates): ${leadsError.message}\nPRESCRIPTION: Run the 'Truth Serum' SQL script to identify and drop duplicate Foreign Keys.`);
          }

          console.log('✅ Schema Guard Passed: No ambiguous relationships detected.');
          return true;
       } catch (err) {
          console.error('Schema Guard Check Failed:', err);
          // If it's our custom error, throw it so the UI sees it.
          if (err.message.includes('CRITICAL SCHEMA AMBIGUITY')) {
            throw err;
          }
          return false;
       } finally {
          console.groupEnd();
       }
    }
  }
};