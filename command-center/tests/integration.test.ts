import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// --- Configuration ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "ey..."; 
const EXECUTE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/execute-remediation-safe`;
const SAVE_PLAN_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/save-manual-plan`;

// Mock User Tokens
const ADMIN_TOKEN = "mock_admin_token_placeholder"; 
const NON_ADMIN_TOKEN = "mock_user_token_placeholder";

// Helper to create test data
const seedIssues = async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Force Global Safe Mode to TRUE for deterministic testing
    // This ensures that even if the DB state was changed by other tests, 
    // we start with Safe Mode ON for these integration tests.
    const { error: settingsError } = await supabase
        .from('system_settings')
        .upsert({ key: 'global_safe_mode', value: true });

    if (settingsError) {
        console.error("Failed to enforce safe mode:", settingsError);
        throw settingsError;
    }
    
    // 2. Create a dummy issue
    const { data: issue, error } = await supabase.from('system_audit_log').insert({
        project_key: 'TEST',
        environment: 'PRODUCTION',
        feature_id: 'test_feature',
        root_cause_type: 'TEST_ERROR',
        is_destructive_action: false,
        is_safe_mode_at_execution: true,
        total_steps: 1,
        destructive_steps: 0,
        execution_status: 'PENDING_REVIEW',
        original_error_message: 'Test error for integration tests',
        doctor_response_jsonb: {
             recommendation: {
                 fix_plan: {
                     steps: [
                         { order: 1, type: "SQL", description: "Safe Test", sql: "SELECT 1;", is_destructive: false, inverse_sql: "SELECT 1;" }
                     ]
                 }
             }
        },
        fix_plan_jsonb: {
            steps: [
                { order: 1, type: "SQL", description: "Safe Test", sql: "SELECT 1;", is_destructive: false, inverse_sql: "SELECT 1;" }
            ]
        }
    }).select().single();

    if (error) throw error;
    return issue;
};

// --- Test Suite ---

Deno.test("execute-remediation-safe: should fail without auth header", async () => {
    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        body: JSON.stringify({ target_issue_id: "some-uuid" })
    });
    assertEquals(response.status, 401);
});

Deno.test("execute-remediation-safe: should fail for non-admin user", async () => {
    const issue = await seedIssues();
    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NON_ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_issue_id: issue.id })
    });
    
    // Depending on mock auth implementation, this is usually 403
    const body = await response.json();
    assertEquals(response.status, 403);
    assertEquals(body.success, false);
});

Deno.test("execute-remediation-safe: should execute a valid safe plan", async () => {
    const issue = await seedIssues();
    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_issue_id: issue.id })
    });

    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.status, "SUCCESS");
});

Deno.test("execute-remediation-safe: should fail if issue is already executed", async () => {
    const issue = await seedIssues();
    
    // Manually set status to SUCCESS first
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('system_audit_log').update({ execution_status: 'SUCCESS' }).eq('id', issue.id);

    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_issue_id: issue.id })
    });

    const body = await response.json();
    assertEquals(response.status, 400); 
    assertEquals(body.error.includes("already executed"), true);
});

Deno.test("execute-remediation-safe: should block destructive actions in safe mode", async () => {
    // Note: seedIssues() enforces safe mode = true
    const issue = await seedIssues();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update the issue to be destructive
    await supabase.from('system_audit_log').update({
        is_destructive_action: true,
        destructive_steps: 1,
        fix_plan_jsonb: {
            steps: [
                { order: 1, type: "SQL", description: "Destructive Test", sql: "DROP TABLE test_table;", is_destructive: true }
            ]
        }
    }).eq('id', issue.id);

    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_issue_id: issue.id })
    });

    const body = await response.json();
    assertEquals(response.status, 403); // Or 200 with status=FAILURE depending on implementation preference, but RPC returns FAILURE status
    
    // In our RPC implementation, we return a JSON object with status FAILURE
    if (response.status === 200) {
        assertEquals(body.status, "FAILURE");
        assertEquals(body.error.includes("Safe Mode"), true);
    } else {
        // Some implementations might throw 403 directly
         assertEquals(response.status, 403);
    }
});


// --- Test Suite: save-manual-plan ---

Deno.test("save-manual-plan: should fail for non-admin", async () => {
    const issue = await seedIssues();
    const response = await fetch(SAVE_PLAN_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NON_ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
            issue_id: issue.id,
            sql_content: "SELECT 1;",
            description: "Test Manual Plan"
        })
    });

    assertEquals(response.status, 403);
});

Deno.test("save-manual-plan: should reject blacklisted SQL patterns", async () => {
    const issue = await seedIssues();
    const dangerousSQL = "DROP DATABASE production;";
    
    const response = await fetch(SAVE_PLAN_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
            issue_id: issue.id,
            sql_content: dangerousSQL,
            description: "Dangerous Manual Plan"
        })
    });

    const body = await response.json();
    assertEquals(response.status, 400);
    assertEquals(body.error.includes("forbidden pattern"), true);
});

Deno.test("save-manual-plan: should successfully save valid SQL", async () => {
    const issue = await seedIssues();
    const validSQL = "UPDATE leads SET status = 'active' WHERE id = '123';";
    
    const response = await fetch(SAVE_PLAN_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
            issue_id: issue.id,
            sql_content: validSQL,
            description: "Valid Manual Plan"
        })
    });

    const body = await response.json();
    assertEquals(response.status, 200);
    assertEquals(body.success, true);
    assertExists(body.plan);

    // Verify DB update
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: updatedIssue } = await supabase.from('system_audit_log').select('*').eq('id', issue.id).single();
    
    assertEquals(updatedIssue.root_cause_type, 'MANUAL_OVERRIDE');
    assertEquals(updatedIssue.fix_plan_jsonb.steps[0].sql, validSQL);
});