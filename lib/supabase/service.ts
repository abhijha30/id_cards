import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. " +
        "Add it to the server environment before using team self-service.",
    );
  }

  return key;
}

/**
 * Server-only Supabase client.
 *
 * IMPORTANT:
 * - Never import this file into a Client Component.
 * - Never expose SUPABASE_SERVICE_ROLE_KEY through NEXT_PUBLIC_*.
 * - Never send this client or its credentials to the browser.
 *
 * This client bypasses Supabase RLS, so it must only be used after
 * the server has validated the requested operation.
 */
export function createServiceClient(): SupabaseClient {
  const { url } = getSupabaseEnv();

  return createClient(url, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
