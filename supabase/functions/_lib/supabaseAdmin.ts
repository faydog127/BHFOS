import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// This admin client is necessary for server-side operations 
// that require elevated privileges, like inserting into tables with RLS.
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)