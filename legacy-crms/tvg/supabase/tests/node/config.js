/**
 * Long-form config accessors for environment variables.
 */

function getEnv(name, fallback) {
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return process.env[name];
  }
  return fallback;
}

var CONFIG = {
  EDGE: getEnv("SUPABASE_EDGE_URL", "http://localhost:54321/functions/v1"),
  REST: getEnv("SUPABASE_REST_URL", "http://localhost:54321/rest/v1"),
  SERVICE: getEnv("SUPABASE_SERVICE_KEY", "service"),
  ANON: getEnv("SUPABASE_ANON_KEY", "anon"),
  TEST_MODE: getEnv("TEST_MODE", "true")
};

module.exports = CONFIG;