import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type AdminSession =
  | { status: "unconfigured" }
  | { status: "anonymous" }
  | { status: "not_admin"; user: User }
  | { status: "admin"; user: User; supabase: SupabaseClient };

/**
 * Resolves who is calling, on the server, from the verified session:
 *  1. `auth.getUser()` asks Supabase Auth to validate the token (no trusting of cookies).
 *  2. Admin status comes from the `admin_users` table (RLS lets a user read only their own row).
 * User-editable metadata is never consulted.
 */
export const getAdminSession = cache(async (): Promise<AdminSession> => {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const { data: row, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError || !row) return { status: "not_admin", user: data.user };
  return { status: "admin", user: data.user, supabase };
});

/**
 * Call at the top of EVERY admin page, route handler and server action.
 * Server actions are public HTTP endpoints: a layout check alone does not protect them.
 */
export async function requireAdmin(): Promise<{ user: User; supabase: SupabaseClient }> {
  const session = await getAdminSession();
  switch (session.status) {
    case "admin":
      return { user: session.user, supabase: session.supabase };
    case "not_admin":
      redirect("/admin/login?error=not-admin");
    case "unconfigured":
      redirect("/admin/login");
    default:
      redirect("/admin/login");
  }
}
