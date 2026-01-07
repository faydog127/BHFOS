/**
 * Environment Configuration
 * Validates and exports environment variables.
 * Implements Fail-Fast strategy to ensure required config is present.
 */

const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
  'VITE_WS_URL'
];

// Map environment variables to a clean config object
const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  wsUrl: import.meta.env.VITE_WS_URL,
};

// Validate required variables
const missingVars = requiredEnvVars.filter(key => !import.meta.env[key]);

if (missingVars.length > 0) {
  const errorMessage = `
    FATAL ERROR: Missing required environment variables:
    ${missingVars.join(', ')}
    
    Please create a .env file in the project root with these variables defined.
    See .env.example or documentation for reference.
  `;
  
  // Log to console for developer visibility
  console.error(errorMessage);
  
  // Throw error to halt execution (Fail-Fast)
  throw new Error(errorMessage);
}

export default env;