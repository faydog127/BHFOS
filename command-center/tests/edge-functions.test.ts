import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// --- Configuration ---
// These are typically loaded from .env.test or similar in a real CI environment
// For this test suite, we assume local or test project variables are available via Deno.env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "ey..."; 
const EXECUTE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/execute-remediation-safe`;
const SAVE_PLAN_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/save-manual-plan`;

// Mock User Tokens (In a real test, you'd generate these on the fly via Admin Auth API)
const ADMIN_TOKEN = "mock_admin_token_placeholder"; 
const NON_ADMIN_TOKEN = "mock_user_token_placeholder";

// Helper to create test data
const setupTestData = async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Create a dummy issue
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
        original_error_message: 'Test error for unit tests',
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

// --- Test Suite: execute-remediation-safe ---

Deno.test("execute-remediation-safe: should fail without auth header", async () => {
    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        body: JSON.stringify({ target_issue_id: "some-uuid" })
    });
    assertEquals(response.status, 401); // Assuming function checks auth immediately
});

Deno.test("execute-remediation-safe: should fail for non-admin user", async () => {
    const issue = await setupTestData();
    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NON_ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_issue_id: issue.id })
    });
    
    // In a mocked environment, this depends on the auth check logic. 
    // Assuming the function queries app_user_roles correctly.
    // If we can't easily mock the DB state for the user in this script, we assume the function handles the 403.
    // For local dev, ensure NON_ADMIN_TOKEN maps to a user without 'admin' role.
    const body = await response.json();
    assertEquals(response.status, 403);
    assertEquals(body.success, false);
});

Deno.test("execute-remediation-safe: should execute a valid safe plan", async () => {
    const issue = await setupTestData();
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
    const issue = await setupTestData();
    
    // Manually set status to SUCCESS first
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('system_audit_log').update({ execution_status: 'SUCCESS' }).eq('id', issue.id);

    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_issue_id: issue.id })
    });

    const body = await response.json();
    assertEquals(response.status, 400); // Bad Request because state is invalid
    assertEquals(body.error.includes("already executed"), true);
});

Deno.test("execute-remediation-safe: should block destructive actions in safe mode", async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Create a destructive issue
    const { data: issue } = await supabase.from('system_audit_log').insert({
        project_key: 'TEST',
        environment: 'PRODUCTION',
        feature_id: 'test_feature_destructive',
        root_cause_type: 'TEST_ERROR',
        is_destructive_action: true,
        is_safe_mode_at_execution: true,
        total_steps: 1,
        destructive_steps: 1,
        execution_status: 'PENDING_REVIEW',
        original_error_message: 'Destructive test',
        fix_plan_jsonb: {
            steps: [
                { order: 1, type: "SQL", description: "Destructive Test", sql: "DROP TABLE test_table;", is_destructive: true }
            ]
        }
    }).select().single();

    // Ensure Safe Mode is ON
    await supabase.from('system_settings').upsert({ key: 'global_safe_mode', value: { enabled: true } });

    const response = await fetch(EXECUTE_FUNCTION_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_issue_id: issue.id })
    });

    const body = await response.json();
    assertEquals(response.status, 403);
    assertEquals(body.error.includes("Safe Mode is ON"), true);
});


// --- Test Suite: save-manual-plan ---

Deno.test("save-manual-plan: should fail for non-admin", async () => {
    const issue = await setupTestData();
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
    const issue = await setupTestData();
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
    const issue = await setupTestData();
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