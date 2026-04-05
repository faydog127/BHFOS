#!/usr/bin/env node
/* eslint-disable no-console */

const base = "https://wwyxohjnyqnegzbxtuxs.supabase.co/functions/v1";
const origin = "https://app.bhfos.com";

const targets = ["quotes-list", "invoices-list"];

for (const fn of targets) {
  const res = await fetch(`${base}/${fn}`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,x-client-info,apikey,content-type",
    },
  });
  console.log(`\n${fn}`);
  console.log(`status=${res.status}`);
  console.log(`allow-origin=${res.headers.get("access-control-allow-origin")}`);
  console.log(`allow-methods=${res.headers.get("access-control-allow-methods")}`);
  console.log(`allow-headers=${res.headers.get("access-control-allow-headers")}`);
}
