import { createBrowserClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type TypedSupabaseClient = ReturnType<typeof createBrowserClient<Database, "public">>;

const browserClients: Record<string, TypedSupabaseClient> = {};

export interface ClientConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  appName?: string;
  cookiePrefix?: string;
  cookieOptions?: CookieOptionsWithName;
}

/**
 * Creates or retrieves a standardized Supabase browser client using @supabase/ssr.
 * Supports session isolation via appName or cookiePrefix.
 * Used by User, Professional, and public Admin UI.
 */
export function createBrowserSupabaseClient(
  configOrAppName?: ClientConfig | string
): TypedSupabaseClient {
  const config = typeof configOrAppName === "string" ? { appName: configOrAppName } : configOrAppName;
  const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const appName = config?.appName || config?.cookiePrefix || process.env.NEXT_PUBLIC_APP_NAME;
  const cookieName = config?.cookieOptions?.name || (appName ? `sb-${appName}-auth-token` : undefined);

  const clientOptions: any = {};
  if (cookieName || config?.cookieOptions) {
    clientOptions.cookieOptions = {
      ...(config?.cookieOptions || {}),
      ...(cookieName ? { name: cookieName } : {}),
    };
  }

  if (typeof window === "undefined") {
    // If called on server without cookies, create standalone browser-compatible client
    return createBrowserClient<Database, "public">(url, anonKey, clientOptions);
  }

  const cacheKey = cookieName || "default";
  if (!browserClients[cacheKey]) {
    browserClients[cacheKey] = createBrowserClient<Database, "public">(url, anonKey, clientOptions);
  }

  return browserClients[cacheKey];
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