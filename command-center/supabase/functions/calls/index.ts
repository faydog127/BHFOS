import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTenantIdFromClaims, getVerifiedClaims } from "../_shared/auth.ts";

// CORS domain whitelist
const HORIZONS_DOMAIN_WWW = Deno.env.get("HORIZONS_DOMAIN") || "https://vent-guys.com";
const CONSOLE_DOMAIN = Deno.env.get("CONSOLE_DOMAIN") || "https://console.vent-guys.com";
const LOCALHOST_DEV_3000 = "http://localhost:3000";
const LOCALHOST_DEV_5173 = "http://localhost:5173";

const ALLOWED_ORIGINS = [
  HORIZONS_DOMAIN_WWW,
  CONSOLE_DOMAIN,
  LOCALHOST_DEV_3000,
  LOCALHOST_DEV_5173,
].filter(Boolean);

// Define allowed types for validation
const dispositionTypes = [ 'NEW', 'INBOUND', 'OUTBOUND', 'VOICEMAIL', 'CALLBACK', 'SCHEDULED', 'NO_ANSWER', 'COMPLETED', 'ESCALATED' ];
const directionTypes = ['INBOUND', 'OUTBOUND'];

// Function to handle CORS and preflight requests
const handleCors = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  });

  if (isAllowedOrigin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  return { headers, isAllowedOrigin, origin };
};

// Function to update lead status if it's 'OPEN'
const updateLeadStatusIfNeeded = async (
  supabase: SupabaseClient,
  leadId: string,
  tenantId: string,
  leadStatus: string | null
) => {
  // Only update if the current status is 'OPEN'
  if (leadStatus === 'OPEN') {
    console.log(`[LEAD_UPDATE] Lead ${leadId} is OPEN. Updating to IN_PROGRESS.`);
    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: 'IN_PROGRESS' })
      .eq('id', leadId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error(`[LEAD_UPDATE] Error updating lead ${leadId} status:`, updateError.message);
    } else {
      console.log(`[LEAD_UPDATE] Successfully updated lead ${leadId} to IN_PROGRESS.`);
    }
  } else {
    console.log(`[LEAD_UPDATE] Lead ${leadId} status is '${leadStatus}', no update needed.`);
  }
};

Deno.serve(async (req: Request) => {
  const corsResult = handleCors(req);
  if (corsResult instanceof Response) {
    return corsResult; // This is a preflight response
  }
  const { headers, isAllowedOrigin, origin } = corsResult;

  if (!isAllowedOrigin) {
    console.warn(`[SECURITY] Blocked POST request from disallowed origin: ${origin}`);
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    let claims;
    try {
      ({ claims } = await getVerifiedClaims(req));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      return new Response(JSON.stringify({ error: message }), { status: 401, headers });
    }

    const jwtTenantId = getTenantIdFromClaims(claims);
    if (!jwtTenantId) {
      return new Response(JSON.stringify({ error: "Unauthorized: missing tenant claim" }), {
        status: 403,
        headers,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();

    // --- Validation ---
    const requiredFields = ["lead_id", "from_number", "to_number", "direction", "disposition"];
    const missing = requiredFields.filter(f => !(f in body));
    if (missing.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }), { status: 400, headers });
    }

    if (!directionTypes.includes(body.direction)) {
      return new Response(JSON.stringify({ error: `Invalid direction. Must be one of: ${directionTypes.join(', ')}` }), { status: 400, headers });
    }

    if (!dispositionTypes.includes(body.disposition)) {
      return new Response(JSON.stringify({ error: `Invalid disposition. Must be one of: ${dispositionTypes.join(', ')}` }), { status: 400, headers });
    }

    if (body.tenant_id && body.tenant_id !== jwtTenantId) {
      return new Response(JSON.stringify({ error: "Tenant mismatch" }), { status: 403, headers });
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('status')
      .eq('id', body.lead_id)
      .eq('tenant_id', jwtTenantId)
      .maybeSingle();

    if (leadError) {
      console.error('[CALL_LOG] Lead lookup error:', leadError);
      throw new Error(`Lead lookup error: ${leadError.message}`);
    }

    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), { status: 404, headers });
    }

    // --- Create Call Record ---
    const callPayload = {
      lead_id: body.lead_id,
      from_number: body.from_number,
      to_number: body.to_number,
      direction: body.direction,
      disposition: body.disposition,
      notes: body.notes || null,
      duration_sec: body.duration_sec || 0,
      recording_url: body.recording_url || null,
      tenant_id: jwtTenantId,
      // created_at is handled by DB default
    };
    
    console.log(`[CALL_LOG] Logging call for lead: ${body.lead_id}`);

    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert(callPayload)
      .select("id, created_at")
      .single();

    if (callError) {
      console.error('[CALL_LOG] Insert error:', callError);
      throw new Error(`Database error: ${callError.message}`);
    }
    
    // --- Update Lead Status After Successful Call Log ---
    await updateLeadStatusIfNeeded(supabase, body.lead_id, jwtTenantId, lead.status || null);

    console.log(`[CALL_LOG] Successfully created call: ${call.id}`);
    return new Response(JSON.stringify({ status: "ok", call }), { status: 201, headers });

  } catch (err) {
    console.error("[ERROR] Unexpected error in /calls function:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), { status: 500, headers });
  }
});
