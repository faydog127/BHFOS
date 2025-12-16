import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0'

// Create a single supabase client for interacting with your database
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)