import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries((await fs.readFile('.env','utf8')).split(/\r?\n/).filter(Boolean).filter(l=>!l.startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]}));
const admin=createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`token.check+${Date.now()}@vent-guys.com`; const pw='Passw0rd!Aexec2';
const {data:u,error:e1}=await admin.auth.admin.createUser({email,password:pw,email_confirm:true,app_metadata:{tenant_id:'tvg'}}); if(e1) throw e1;
try {
 const {data,error}=await client.auth.signInWithPassword({email,password:pw}); if(error) throw error;
 console.log(JSON.stringify({token_prefix:data.session?.access_token?.slice(0,30), token_len:data.session?.access_token?.length, user_id:data.user?.id},null,2));
} finally { await admin.auth.admin.deleteUser(u.user.id);} 
