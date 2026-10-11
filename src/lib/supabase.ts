import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const configurationError = !url || !key || url.includes('YOUR_PROJECT') || key === 'YOUR_PUBLISHABLE_KEY'
  ? 'Supabase is not configured. Add the project URL and publishable key to .env.local.'
  : null;

export const supabase = configurationError
  ? null
  : createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

export function requireSupabase() {
  if (!supabase) throw new Error(configurationError ?? 'Supabase is unavailable.');
  return supabase;
}
