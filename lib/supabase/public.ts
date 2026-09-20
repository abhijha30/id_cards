import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Cookie-less, session-less client that always acts as the `anon` role.
 *
 * All public pages use this client, so even when an administrator is signed in, the public
 * site shows exactly what a visitor would see (never unpublished profiles).
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
