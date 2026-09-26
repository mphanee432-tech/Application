import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export type AdminSupabaseClient = SupabaseClient<Database, "public">;

/**
 * Creates an administrative Supabase client using the service role key to bypass Row Level Security.
 * For use strictly in secure server-side environments (Server Actions, Route Handlers).
 * Supports both createAdminClient(url, key) and createAdminClient(key, url) or createAdminClient().
 */
export function createAdminClient(
  arg1?: string,
  arg2?: string
): AdminSupabaseClient {
  let url = "";
  let key = "";

  if (arg1 && (arg1.startsWith("http://") || arg1.startsWith("https://"))) {
    url = arg1;
    key = arg2 || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  } else if (arg2 && (arg2.startsWith("http://") || arg2.startsWith("https://"))) {
    url = arg2;
    key = arg1 || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  } else {
    key = arg1 || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    url = arg2 || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  }

  // Fallbacks if not set
  if (!url) {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  }
  if (!key) {
    key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  }

  if (!url || !key) {
    throw new Error(
      `createAdminClient requires valid credentials. (NEXT_PUBLIC_SUPABASE_URL: ${url ? "PRESENT" : "MISSING"}, SUPABASE_SERVICE_ROLE_KEY: ${key ? "PRESENT" : "MISSING"})`
    );
  }

  return createSupabaseClient<Database, "public">(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
