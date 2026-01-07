import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wwyxohjnyqnegzbxtuxs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3eXhvaGpueXFuZWd6Ynh0dXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTY5ODcsImV4cCI6MjA3ODEzMjk4N30.zcscRw34pvKfsx1z3dkkvbznc637xlaJcK_t3r6cClg';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
