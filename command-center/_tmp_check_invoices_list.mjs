import { readFile } from "node:fs/promises";
const url = "https://wwyxohjnyqnegzbxtuxs.supabase.co/functions/v1/invoices-list";
const envText = await readFile(".env", "utf8");
const keyMatch = envText.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m);
const key = keyMatch ? keyMatch[1] : "";
const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "apikey": key,
    "authorization": "Bearer " + key
  },
  body: JSON.stringify({ tenant_id: "tvg", status: "all" })
});
const text = await res.text();
console.log(JSON.stringify({ status: res.status, sample: text.slice(0, 500) }, null, 2));
