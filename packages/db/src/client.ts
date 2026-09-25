import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type TypedSupabaseClient = ReturnType<typeof createBrowserClient<Database, "public">>;

let browserClient: TypedSupabaseClient | null = null;

export interface ClientConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/**
 * Creates or retrieves a singleton standardized Supabase browser client using @supabase/ssr.
 * Used by User, Professional, and public Admin UI.
 */
export function createBrowserSupabaseClient(config?: ClientConfig): TypedSupabaseClient {
  const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (typeof window === "undefined") {
    // If called on server without cookies, create standalone browser-compatible client
    return createBrowserClient<Database, "public">(url, anonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database, "public">(url, anonKey);
  }

  return browserClient;
}

/**
 * Alias for createBrowserSupabaseClient
 */
export const createClient = createBrowserSupabaseClient;

/**
 * ONLY used in Next.js Server Components, Server Actions, or API Routes inside the Admin app.
 * Uses the standard @supabase/supabase-js client to bypass RLS.
 */
export const createAdminClient = (supabaseUrl: string, serviceRoleKey: string) => {
  return createSupabaseJsClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};