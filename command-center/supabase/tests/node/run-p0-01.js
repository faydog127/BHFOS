/**
 * Focus runner for P0-01 Tenant Isolation Lock.
 *
 * Env vars:
 * - SUPABASE_EDGE_URL (default: http://localhost:25431/functions/v1)
 * - SUPABASE_REST_URL (default: http://localhost:25431/rest/v1)
 * - SUPABASE_SERVICE_KEY
 */

var helpers = require("./helpers.js");

require("./p0_01_tenant_isolation.test.js");

helpers.runAllTests();

