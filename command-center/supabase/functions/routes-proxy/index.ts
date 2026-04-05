// Routes proxy for Google Routes API.
const ALLOWED_ORIGINS = [
  "https://route.bhfos.com",
  "https://faydog127.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
].filter(Boolean);

const GOOGLE_ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const FIELD_MASK = [
  "routes.distanceMeters",
  "routes.duration",
  "routes.localizedValues",
  "routes.optimizedIntermediateWaypointIndex",
  "routes.polyline.encodedPolyline",
  "routes.legs.distanceMeters",
  "routes.legs.duration",
  "routes.legs.localizedValues",
  "routes.legs.startLocation",
  "routes.legs.endLocation",
].join(",");

function buildCorsHeaders(origin: string) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!googleApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_MAPS_API_KEY secret." }),
      { status: 500, headers },
    );
  }

  try {
    const body = await req.json();
    const originAddress = (body.origin || "").trim();
    const destinationAddress = (body.destination || "").trim();
    const stops = Array.isArray(body.stops) ? body.stops : [];

    if (!originAddress || !destinationAddress) {
      return new Response(
        JSON.stringify({ error: "Origin and destination are required." }),
        { status: 400, headers },
      );
    }

    const travelMode = body.travelMode || "DRIVE";
    const routingPreference =
      travelMode === "DRIVE" ? body.routingPreference || "TRAFFIC_AWARE" : undefined;

    const requestBody: Record<string, unknown> = {
      origin: { address: originAddress },
      destination: { address: destinationAddress },
      travelMode,
      units: body.units || "IMPERIAL",
      routeModifiers: {
        avoidTolls: Boolean(body.avoidTolls),
        avoidHighways: Boolean(body.avoidHighways),
        avoidFerries: Boolean(body.avoidFerries),
      },
    };

    if (routingPreference) {
      requestBody.routingPreference = routingPreference;
    }

    if (stops.length) {
      requestBody.intermediates = stops.map((address: string) => ({ address }));
      requestBody.optimizeWaypointOrder =
        typeof body.optimizeWaypointOrder === "boolean"
          ? body.optimizeWaypointOrder
          : stops.length > 1;
    }

    const googleResponse = await fetch(GOOGLE_ROUTES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await googleResponse.text();

    return new Response(payload, {
      status: googleResponse.status,
      headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error." }),
      { status: 500, headers },
    );
  }
});
