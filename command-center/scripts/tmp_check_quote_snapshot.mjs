import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries((await fs.readFile('.env','utf8')).split(/\r?\n/).filter(Boolean).filter(l=>!l.startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]}));
const admin=createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const quoteId='0aa8d876-8e69-4fc1-a969-5ac29bee767b';
const {data,error}=await admin.from('quotes').select('id,tenant_id,line_items').eq('id',quoteId).single();
if(error) throw error;
console.log(JSON.stringify(data,null,2));
