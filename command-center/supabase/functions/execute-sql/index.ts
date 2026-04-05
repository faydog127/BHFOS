import { corsHeaders } from '../_lib/cors.ts';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { scripts } from './scripts.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';

const SCRIPTS = scripts;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let claims;
    try {
      ({ claims } = await getVerifiedClaims(req));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const jwtTenantId = getTenantIdFromClaims(claims);
    if (!jwtTenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing tenant claim' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { scriptKey, tenant_id: bodyTenantId } = await req.json();

    if (bodyTenantId && bodyTenantId !== jwtTenantId) {
      return new Response(JSON.stringify({ error: 'Tenant mismatch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    if (!scriptKey || !SCRIPTS[scriptKey]) {
      return new Response(JSON.stringify({ error: 'Invalid script key provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const sql = SCRIPTS[scriptKey];
    const { error } = await supabaseAdmin.rpc('execute_sql', { sql_query: sql });

    if (error) {
      console.error('SQL Execution Error:', error);
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({ message: `Successfully executed '${scriptKey}' script.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('Function Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
