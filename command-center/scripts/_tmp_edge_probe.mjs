#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
const envRaw = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }),
);

const base = `${env.VITE_SUPABASE_URL}/functions/v1`;
const anon = env.VITE_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const body = { tenant_id: "tvg", status: "all" };

async function call(functionName, tokenLabel, token) {
  const res = await fetch(`${base}/${functionName}`, {
    method: "POST",
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  const count = Array.isArray(parsed?.data)
    ? parsed.data.length
    : Array.isArray(parsed)
      ? parsed.length
      : null;
  console.log(
    `${functionName} [${tokenLabel}] status=${res.status} count=${count ?? "n/a"} sample=${typeof parsed === "string" ? parsed.slice(0, 120) : JSON.stringify(parsed).slice(0, 180)}`,
  );
}

await call("quotes-list", "anon", anon);
await call("quotes-list", "service", service);
await call("invoices-list", "anon", anon);
await call("invoices-list", "service", service);
