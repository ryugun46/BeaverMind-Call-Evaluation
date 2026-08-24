import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getServerEnvironment,
  type ServerEnvironment,
} from "@/lib/server/env";

let serverClient: SupabaseClient | undefined;

/**
 * Next.js extends server fetches with a persistent data cache. Lifecycle reads
 * must always reach Supabase or polling can keep returning the first
 * `processing` snapshot after the row has become terminal.
 */
function uncachedServerFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}

export function createServerSupabaseClient(
  environment: ServerEnvironment = getServerEnvironment()
): SupabaseClient {
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    global: {
      fetch: uncachedServerFetch,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function getServerSupabaseClient(): SupabaseClient {
  serverClient ??= createServerSupabaseClient();
  return serverClient;
}
