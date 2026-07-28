// deno-lint-ignore-file no-import-prefix
import {
  assertEquals,
  assertMatch,
  assertNotMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

const { buildCorsHeaders } = await import(
  "../../supabase/functions/_shared/publicUtils.ts"
);

let invoiceSaveHandler:
  typeof import("../../supabase/functions/invoice-save/index.ts").handleInvoiceSaveRequest;

const loadInvoiceSaveHandler = async () => {
  if (!invoiceSaveHandler) {
    const originalServe = Deno.serve;
    Object.defineProperty(Deno, "serve", {
      configurable: true,
      value: () => ({
        finished: Promise.resolve(),
        shutdown: () => Promise.resolve(),
      }),
    });
    try {
      invoiceSaveHandler = (
        await import("../../supabase/functions/invoice-save/index.ts")
      ).handleInvoiceSaveRequest;
    } finally {
      Object.defineProperty(Deno, "serve", {
        configurable: true,
        value: originalServe,
      });
    }
  }
  return invoiceSaveHandler;
};

const stagingOrigin = "https://command-center-staging-woad.vercel.app";

Deno.test("public CORS accepts only complete normalized allowlisted origins", () => {
  for (
    const origin of [
      stagingOrigin,
      `${stagingOrigin}/`,
      "https://app.bhfos.com",
      "http://localhost:3000",
    ]
  ) {
    const cors = buildCorsHeaders(origin);
    assertEquals(cors.allowed, new URL(origin).origin);
    assertEquals(
      cors.headers["Access-Control-Allow-Origin"],
      new URL(origin).origin,
    );
    assertEquals(
      cors.headers["Access-Control-Allow-Methods"],
      "GET,POST,OPTIONS",
    );
  }

  for (
    const origin of [
      null,
      "null",
      "not-an-origin",
      "https://unrelated.vercel.app",
      `https://prefix.${new URL(stagingOrigin).hostname}`,
      `${stagingOrigin}.example.com`,
      `${stagingOrigin}/deceptive`,
      "https://wwyxohjnyqnegzbxtuxs.supabase.co",
      "https://sdzhdupekcnekesbtxsl.supabase.co",
    ]
  ) {
    const cors = buildCorsHeaders(origin);
    assertEquals(cors.allowed, null);
    assertEquals(cors.headers["Access-Control-Allow-Origin"], undefined);
  }
});

Deno.test("public payment handlers share the corrected CORS boundary", async () => {
  for (
    const relativePath of [
      "../../supabase/functions/public-pay/index.ts",
      "../../supabase/functions/public-invoice/index.ts",
    ]
  ) {
    const source = await Deno.readTextFile(
      new URL(relativePath, import.meta.url),
    );
    assertMatch(source, /const cors = buildCorsHeaders\(origin\)/);
    assertMatch(source, /if \(!cors\.allowed && origin\)/);
  }
});

Deno.test("invoice-save converts authentication failures to generic 401 responses", async () => {
  const handler = await loadInvoiceSaveHandler();
  const authenticationFailures = [
    new Error("Missing Authorization Bearer token."),
    new Error("Invalid JWT format."),
    new Error("JWT expired at a sensitive timestamp"),
    new Error("JWKS verification failed with sensitive details"),
  ];

  for (const failure of authenticationFailures) {
    let bodyReads = 0;
    const request = {
      method: "POST",
      headers: new Headers(),
      json: () => {
        bodyReads += 1;
        return Promise.resolve({ tenant_id: "must-not-be-read" });
      },
    } as Request;
    const response = await handler(request, {
      verifyClaims: () => Promise.reject(failure),
    });
    const body = await response.text();

    assertEquals(response.status, 401);
    assertEquals(bodyReads, 0);
    assertEquals(body, JSON.stringify({ error: "Unauthorized" }));
    assertNotMatch(body, /JWT|JWKS|Bearer|sensitive|timestamp/i);
  }
});

Deno.test("invoice-save fails closed for empty and malformed bearer tokens", async () => {
  const handler = await loadInvoiceSaveHandler();
  for (const authorization of ["Bearer ", "Bearer not-a-jwt"]) {
    const response = await handler(
      new Request("http://localhost/functions/v1/invoice-save", {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: "{}",
      }),
    );
    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized" });
  }
});

Deno.test("invoice-save preserves valid-auth business validation and genuine 500s", async () => {
  const handler = await loadInvoiceSaveHandler();
  const validClaims = () =>
    Promise.resolve({
      token: "redacted",
      claims: { app_metadata: { tenant_id: "staging-test" } },
    });

  const validationResponse = await handler(
    new Request("http://localhost/functions/v1/invoice-save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    { verifyClaims: validClaims },
  );
  assertEquals(validationResponse.status, 400);
  assertEquals(await validationResponse.json(), { error: "Missing tenant_id" });

  const internalFailureResponse = await handler(
    {
      method: "POST",
      headers: new Headers(),
      json: () => Promise.reject(new Error("sensitive internal failure")),
    } as unknown as Request,
    { verifyClaims: validClaims },
  );
  const internalBody = await internalFailureResponse.text();
  assertEquals(internalFailureResponse.status, 500);
  assertEquals(
    internalBody,
    JSON.stringify({ error: "Invoice could not be saved." }),
  );
  assertNotMatch(internalBody, /sensitive|internal failure/i);
});
