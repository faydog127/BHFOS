import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries((await fs.readFile('.env','utf8')).split(/\r?\n/).filter(Boolean).filter(l=>!l.startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]}));
const admin=createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`fn.compare+${Date.now()}@vent-guys.com`; const pw='Passw0rd!Aexec2';
const {data:u,error:e1}=await admin.auth.admin.createUser({email,password:pw,email_confirm:true,app_metadata:{tenant_id:'tvg'}}); if(e1) throw e1;
try {
 const {data,error}=await client.auth.signInWithPassword({email,password:pw}); if(error) throw error;
 const token=data.session.access_token;
 const headers={ 'Content-Type':'application/json', apikey: env.VITE_SUPABASE_ANON_KEY, Authorization:`Bearer ${token}` };
 const r1=await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/quotes-list`,{method:'POST',headers,body:JSON.stringify({tenant_id:'tvg',status:'all'})});
 const t1=await r1.text();
 const r2=await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/send-estimate`,{method:'POST',headers:{...headers,'x-tenant-id':'tvg'},body:JSON.stringify({quote_id:'9f8d3493-ffc2-448b-9ee9-5770f7ac985d',tenant_id:'tvg',email:'erron.fayson@gmail.com'})});
 const t2=await r2.text();
 console.log(JSON.stringify({quotes_list:{status:r1.status,body:t1.slice(0,120)},send_estimate:{status:r2.status,body:t2.slice(0,120)}},null,2));
} finally { await admin.auth.admin.deleteUser(u.user.id);} 
