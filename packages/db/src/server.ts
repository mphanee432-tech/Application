import { createServerClient as createSSRServerClient, type CookieOptions, type CookieOptionsWithName } from "@supabase/ssr";
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
  appName?: string;
  cookiePrefix?: string;
  cookieOptions?: CookieOptionsWithName;
}

/**
 * Standardized Supabase server client using @supabase/ssr.
 * Accepts cookieStore adapter (e.g. from Next.js headers).
 * Supports session isolation via appName or cookiePrefix.
 */
export function createServerSupabaseClient(
  cookieStore?: CookieMethodsServer,
  configOrAppName?: ServerConfig | string
): ServerSupabaseClient {
  const config = typeof configOrAppName === "string" ? { appName: configOrAppName } : configOrAppName;
  const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const appName = config?.appName || config?.cookiePrefix || process.env.NEXT_PUBLIC_APP_NAME;
  const cookieName = config?.cookieOptions?.name || (appName ? `sb-${appName}-auth-token` : undefined);

  const clientOptions: any = {
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
  };

  if (cookieName || config?.cookieOptions) {
    clientOptions.cookieOptions = {
      ...(config?.cookieOptions || {}),
      ...(cookieName ? { name: cookieName } : {}),
    };
  }

  return createSSRServerClient<Database, "public">(url, anonKey, clientOptions);
}

/**
 * Creates a server client directly by passing Next.js cookies() accessor.
 * Supports session isolation via appName or cookiePrefix.
 */
export function createNextServerClient(
  cookieStore: any,
  configOrAppName?: ServerConfig | string
): ServerSupabaseClient {
  const config = typeof configOrAppName === "string" ? { appName: configOrAppName } : configOrAppName;
  const url = config?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = config?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const appName = config?.appName || config?.cookiePrefix || process.env.NEXT_PUBLIC_APP_NAME;
  const cookieName = config?.cookieOptions?.name || (appName ? `sb-${appName}-auth-token` : undefined);

  const clientOptions: any = {
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
  };

  if (cookieName || config?.cookieOptions) {
    clientOptions.cookieOptions = {
      ...(config?.cookieOptions || {}),
      ...(cookieName ? { name: cookieName } : {}),
    };
  }

  return createSSRServerClient<Database, "public">(url, anonKey, clientOptions);
}

/**
 * Alias for createServerSupabaseClient
 */
export const createServerClient = createServerSupabaseClient;

