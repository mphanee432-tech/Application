import { createServerClient as createSSRServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "../types";

export type ServerSupabaseClient = ReturnType<typeof createSSRServerClient<Database, "public">>;

export interface CookieMethodsServer {
  getAll: () => { name: string; value: string }[] | Promise<{ name: string; value: string }[]>;
  setAll?: (
    cookiesToSet: {
      name: string;
      value: string;
      options?: CookieOptions;
    }[]
  ) => void | Promise<void>;
}

export interface ServerConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/**
 * Standardized Supabase server client using @supabase/ssr.
 * Accepts cookieStore adapter (e.g. from Next.js headers).
 */
export function createServerSupabaseClient(
  cookieStore?: CookieMethodsServer,
  config?: ServerConfig
): ServerSupabaseClient {
  const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createSSRServerClient<Database, "public">(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll ? cookieStore.getAll() : [];
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        if (cookieStore?.setAll) {
          cookieStore.setAll(cookiesToSet);
        }
      },
    },
  });
}

/**
 * Creates a server client directly by passing Next.js cookies() accessor
 */
export function createNextServerClient(
  cookieStore: any,
  config?: ServerConfig
): ServerSupabaseClient {
  const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createSSRServerClient<Database, "public">(url, anonKey, {
    cookies: {
      getAll() {
        return typeof cookieStore?.getAll === "function" ? cookieStore.getAll() : [];
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: any }) => {
            if (typeof cookieStore?.set === "function") {
              cookieStore.set(name, value, options);
            }
          });
        } catch {
          // Ignores set cookies from Server Components if invoked outside route/action
        }
      },
    },
  });
}

/**
 * Alias for createServerSupabaseClient
 */
export const createServerClient = createServerSupabaseClient;

