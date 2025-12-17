import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS domain whitelist
const HORIZONS_DOMAIN_WWW = "https://theventguys.com";
const HORIZONS_DOMAIN_NOWWW = "http://theventguys.com"; // Handle non-https if needed
const CONSOLE_DOMAIN = "https://console.theventguys.com";
const LOCALHOST_DEV_3000 = "http://localhost:3000";
const LOCALHOST_DEV_5173 = "http://localhost:5173";

const ALLOWED_ORIGINS = [
  HORIZONS_DOMAIN_WWW,
  HORIZONS_DOMAIN_NOWWW,
  CONSOLE_DOMAIN,
  LOCALHOST_DEV_3000,
  LOCALHOST_DEV_5173
].filter(Boolean);


// Utility: Normalize phone to E.164
function toE164(p: string): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("1") ? `+${d}` : `+1${d}`;
}

// Utility: Log blocked request
function logBlockedRequest(origin: string, reason: string) {
  console.warn(`[SECURITY] Blocked request from origin: ${origin} | Reason: ${reason}`);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  // Base headers
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  });
  
  if (isAllowedOrigin) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else {
    headers.set("Access-Control-Allow-Origin", "null");
  }

  // Handle preflight (OPTIONS) requests
  if (req.method === "OPTIONS") {
    console.log(`[PREFLIGHT] Origin: ${origin} | Allowed: ${isAllowedOrigin}`);
    return new Response("ok", { headers });
  }

  // Enforce origin whitelist for actual POSTs
  if (!isAllowedOrigin) {
    logBlockedRequest(origin, "Origin not in whitelist");
    return new Response(
      JSON.stringify({ error: "Origin not allowed", received_origin: origin }),
      { status: 403, headers }
    );
  }
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    // Supabase client (service role for upserts)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    console.log("[LEAD INTAKE] Received payload:", JSON.stringify(body, null, 2));


    const required = ["first_name", "phone", "service_type", "customer_type", "source_kind"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }), { status: 400, headers });
    }

    const phone = toE164(body.phone);
    const email = body.email || null;

    console.log(`[LEAD] Processing lead from ${origin} | Phone: ${phone}`);

    // --- Transactional Upsert Logic ---
    let contact_id: string | null = null;
    let organization_id: string | null = null;
    let property_id: string | null = null;

    // 1) Upsert Contact
    const { data: existingContact, error: contactSelectError } = await supabase
      .from("contacts")
      .select("id")
      .or(`phone.eq.${phone},email.eq.${email}`)
      .maybeSingle();

    if (contactSelectError) throw contactSelectError;

    if (existingContact) {
      contact_id = existingContact.id;
      const { error: contactUpdateError } = await supabase
        .from("contacts")
        .update({ first_name: body.first_name, last_name: body.last_name || null, email: email || undefined })
        .eq("id", contact_id);
      if (contactUpdateError) throw contactUpdateError;
      console.log(`[CONTACT] Updated: ${contact_id}`);
    } else {
      const { data: newContact, error: contactInsertError } = await supabase
        .from("contacts")
        .insert({ first_name: body.first_name, last_name: body.last_name || null, phone, email })
        .select("id")
        .single();
      if (contactInsertError) throw contactInsertError;
      contact_id = newContact.id;
      console.log(`[CONTACT] Created: ${contact_id}`);
    }

    // This is a simplified version of the upsert logic.
    // A full implementation would also handle organization and property upserts.
    
    // START: Persona Fallback Logic
    let persona = body.persona;
    if (!persona) {
      switch (body.customer_type) {
        case 'COMMERCIAL':
          persona = 'BUSINESS_CONTACT';
          break;
        case 'GOVERNMENT':
          persona = 'AGENCY_CONTACT';
          break;
        case 'RESIDENTIAL':
        default:
          persona = 'HOMEOWNER_INQUIRY';
          break;
      }
    }
    // END: Persona Fallback Logic

    // 2) Create Lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        status: "OPEN",
        persona: persona,
        pqi: body.pqi || 25, // Add PQI with a default
        priority: body.priority ?? "NORMAL",
        customer_type: body.customer_type,
        is_partner: body.is_partner ?? false,
        contact_id,
        first_name: body.first_name,
        last_name: body.last_name || null,
        phone,
        email,
        property_name: body.property_name || null,
        message: body.message || null,
        service: body.service_type,
        concerns: body.concerns ? { free_text: body.concerns } : null,
        source_kind: body.source_kind,
        source_detail: body.source_detail || null,
        landing_url: body.landing_page_url || null,
        utm_source: body.utm_source || 'direct',
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_term: body.utm_term || null,
        utm_content: body.utm_content || null,
        gclid: body.gclid || null,
        consent_marketing: body.consent_marketing ?? false,
      })
      .select("id, created_at")
      .single();

    if (leadError) throw leadError;

    console.log(`[LEAD] Successfully created: ${lead.id}`);

    return new Response(JSON.stringify({ status: "ok", id: lead.id, created_at: lead.created_at }), { status: 201, headers });
  } catch (err) {
    console.error("[ERROR] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), { status: 500, headers });
  }
});