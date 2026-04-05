import fs from "node:fs";
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l&& !l.trim().startsWith('#') && l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)];}));
const url=env.VITE_SUPABASE_URL;
const key=env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const h={apikey:key, Authorization:'Bearer '+key};
const j=async(p)=>{const r=await fetch(url+p,{headers:h}); const t=await r.text(); if(!r.ok) throw new Error(r.status+' '+p+' '+t.slice(0,120)); return JSON.parse(t)};
const quotes=await j('/rest/v1/quotes?select=id,estimate_id,line_items');
const estIds=[...new Set(quotes.map(q=>q.estimate_id).filter(Boolean))];
let tierFromLineItems=0;
for(const q of quotes){const txt=JSON.stringify(q.line_items||{}).toLowerCase(); if(txt.includes('"tier"')||txt.includes('good')||txt.includes('better')||txt.includes('best')) tierFromLineItems++;}
let tierFromEstimates=0;
if(estIds.length){
  const inList='('+estIds.join(',')+')';
  const estimates=await j('/rest/v1/estimates?select=id,services&id=in.'+inList);
  for(const e of estimates){const txt=JSON.stringify(e.services||{}).toLowerCase(); if(txt.includes('"tier"')||txt.includes('good')||txt.includes('better')||txt.includes('best')) tierFromEstimates++;}
}
console.log(JSON.stringify({totalQuotes:quotes.length,quotesWithEstimateId:estIds.length,quotesWithTierSignalInLineItems:tierFromLineItems,estimatesWithTierSignal:tierFromEstimates},null,2));
