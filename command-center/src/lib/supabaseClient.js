/**
 * This file serves as a proxy to the customSupabaseClient.
 * It ensures backward compatibility for files importing from 'src/lib/supabaseClient'.
 */
import { supabase } from './customSupabaseClient';

export { supabase };