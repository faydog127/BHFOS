import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries((await fs.readFile('.env','utf8')).split(/\r?\n/).filter(Boolean).filter(l=>!l.startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]}));
const admin=createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await admin.from('estimates').select('*').limit(1);
if(error) throw error;
console.log(JSON.stringify(data?.[0]||null,null,2));
