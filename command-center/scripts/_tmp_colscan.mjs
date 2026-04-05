import fs from "node:fs";
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l && !l.trim().startsWith('#') && l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)];}));
const url=env.VITE_SUPABASE_URL;
const key=env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const h={apikey:key, Authorization:'Bearer '+key};
const qs='table_schema=eq.public&select=table_name,column_name,data_type&or=(column_name.ilike.%25margin%25,column_name.ilike.%25cost%25,column_name.ilike.%25labor%25,column_name.ilike.%25material%25,column_name.ilike.%25equipment%25,column_name.ilike.%25tier%25)';
const r=await fetch(url+'/rest/v1/information_schema.columns?'+qs,{headers:h});
const t=await r.text();
if(!r.ok){console.log('status',r.status,t.slice(0,300)); process.exit(0);}
const arr=JSON.parse(t);
console.log('matches',arr.length);
for(const row of arr){console.log(`${row.table_name}.${row.column_name} (${row.data_type})`)}
