import { corsHeaders } from '../_lib/cors.ts';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { CRITICAL_SQL, HIGH_SQL, MEDIUM_SQL } from './scripts.ts';

const SCRIPTS = {
  critical: CRITICAL_SQL,
  high: HIGH_SQL,
  medium: MEDIUM_SQL,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { scriptKey } = await req.json();

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