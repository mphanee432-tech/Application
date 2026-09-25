import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export type AdminSupabaseClient = SupabaseClient<Database, "public">;

/**
 * Creates an administrative Supabase client using the service role key to bypass Row Level Security.
 * For use strictly in secure server-side environments (Server Actions, Route Handlers).
 */
export function createAdminClient(
  serviceRoleKey?: string,
  supabaseUrl?: string
): AdminSupabaseClient {
  const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) {
    throw new Error(
      "createAdminClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createSupabaseClient<Database, "public">(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

