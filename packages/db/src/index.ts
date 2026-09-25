// Standardized clients
export {
  createBrowserSupabaseClient,
  createClient,
  type ClientConfig,
  type TypedSupabaseClient,
} from "./client";

export {
  createServerSupabaseClient,
  createNextServerClient,
  createServerClient,
  type CookieMethodsServer,
  type ServerConfig,
  type ServerSupabaseClient,
} from "./server";

export {
  createAdminClient,
  type AdminSupabaseClient,
} from "./admin";

// Typed helper functions
export * from "./helpers";

// Auto-generated database types
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "../types";

