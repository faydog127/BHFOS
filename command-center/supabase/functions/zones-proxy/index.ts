import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Zones proxy for route planner lookups.

const ALLOWED_ORIGINS = [
  "https://route.bhfos.com",
  "https://faydog127.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
].filter(Boolean);

function buildCorsHeaders(origin: string) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Vary": "Origin",
  });

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else {
    headers.set("Access-Control-Allow-Origin", "null");
  }

  return headers;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const headers = buildCorsHeaders(origin);
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (!isAllowedOrigin) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed", received_origin: origin }),
      { status: 403, headers },
    );
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables." }),
        { status: 500, headers },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const [{ data: zones, error: zonesError }, { data: properties, error: propertiesError }] =
      await Promise.all([
        supabase
          .from("zones")
          .select("id,zone_name")
          .order("zone_name", { ascending: true }),
        supabase
          .from("properties")
          .select("property_name,address_line_1,city,state,zip,zone_id,is_active")
          .eq("is_active", true)
          .order("property_name", { ascending: true }),
      ]);

    if (zonesError) throw zonesError;
    if (propertiesError) throw propertiesError;

    return new Response(JSON.stringify({ zones, properties }), { headers });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error." }),
      { status: 500, headers },
    );
  }
});
