import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type AdminSupabaseClient = SupabaseClient<Database, "public">;

/**
 * ONLY used in Next.js Server Components, Server Actions, or API Routes.
 * Uses the secret service_role key to bypass RLS.
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