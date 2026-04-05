import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries((await fs.readFile('.env','utf8')).split(/\r?\n/).filter(Boolean).filter(l=>!l.startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]}));
const admin=createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

const quoteId='0aa8d876-8e69-4fc1-a969-5ac29bee767b';
const tenantId='tvg';
const recipient='erron.fayson@gmail.com';

const tempEmail=`send.pass+${Date.now()}@vent-guys.com`;
const pw='Passw0rd!Aexec2';
const {data:newUser,error:eUser}=await admin.auth.admin.createUser({email:tempEmail,password:pw,email_confirm:true,app_metadata:{tenant_id:tenantId}});
if(eUser) throw eUser;

try {
  const {data:si,error:eSi}=await client.auth.signInWithPassword({email:tempEmail,password:pw});
  if(eSi) throw eSi;
  const token=si.session?.access_token;
  if(!token) throw new Error('No token');

  const {data:quote,error:eQuote}=await admin.from('quotes').select('id,tenant_id,lead_id,user_id,total_amount,quote_number').eq('id',quoteId).single();
  if(eQuote) throw eQuote;

  const total = Number(quote.total_amount || 0);
  const estLabor = Number((total * 0.4).toFixed(2));
  const estMaterial = Number((total * 0.2).toFixed(2));
  const estEquipment = Number((total * 0.1).toFixed(2));
  const estTotal = Number((estLabor + estMaterial + estEquipment).toFixed(2));

  const {data:estimate,error:eEstimate}=await admin.from('estimates').insert({
    tenant_id: tenantId,
    user_id: quote.user_id,
    lead_id: quote.lead_id,
    status: 'submitted',
    step: 4,
    estimate_number: `EST-${Date.now()}`,
    total_price: total,
    services: [{
      name: 'Dryer Vent Safety Clean',
      code: 'DV-STD',
      qty: 1,
      unitPrice: total,
      total,
      estimated_labor: estLabor,
      estimated_material: estMaterial,
      estimated_equipment: estEquipment,
      total_estimated_cost: estTotal
    }],
    scope_of_work: {},
    property_details: {}
  }).select('id').single();
  if(eEstimate) throw eEstimate;

  const {error:eUpdate}=await admin.from('quotes').update({estimate_id:estimate.id}).eq('id',quoteId);
  if(eUpdate) throw eUpdate;

  const resp = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/send-estimate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({ quote_id: quoteId, email: recipient, tenant_id: tenantId }),
  });
  const json = await resp.json().catch(()=>({}));
  console.log(JSON.stringify({status:resp.status, ok:resp.ok, response:json, estimate_id:estimate.id, quote_number: quote.quote_number}, null, 2));
} finally {
  await admin.auth.admin.deleteUser(newUser.user.id);
}
