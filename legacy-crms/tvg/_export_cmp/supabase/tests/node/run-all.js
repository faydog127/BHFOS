/**
 * Tiny test runner loader. Requires each test file (CommonJS),
 * which registers tests via addTest(), then executes them in sequence.
 */

var helpers = require("./helpers.js");

// Load test files (synchronous require)
require("./lead_intake.test.js");
require("./smartdocs_send.test.js");
require("./update_checklist.test.js");
require("./signals_pqi.test.js");
require("./rls_policies.test.js");
require("./smartdocs_suggest.test.js");
require("./pipeline_endpoints.test.js");
require("./audience_alignment.test.js");

// Run
helpers.runAllTests();