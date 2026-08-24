import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getServerEnvironment,
  type ServerEnvironment,
} from "@/lib/server/env";

let serverClient: SupabaseClient | undefined;

export function createServerSupabaseClient(
  environment: ServerEnvironment = getServerEnvironment()
): SupabaseClient {
  return createClient(environment.SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
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
