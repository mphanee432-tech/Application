import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Used by User, Professional, and public Admin UI (restricted by RLS)
export const createSupabaseClient = (supabaseUrl: string, supabaseAnonKey: string) => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
};

// ONLY used in Next.js Server Components, Server Actions, or API Routes