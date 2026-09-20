"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { loginSchema, safeAdminRedirect } from "@/lib/validation/auth";
import { errorState, formString, formValues, issuesToFieldErrors, type ActionState } from "@/lib/validation/common";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return errorState("Supabase is not configured yet. Set the environment variables listed in .env.example.");
  }

  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return errorState("Check the highlighted fields.", issuesToFieldErrors(parsed.error.issues), formValues(formData));
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    if (error?.status === 429) return errorState("Too many attempts. Wait a few minutes and try again.", undefined, formValues(formData));
    return errorState("The email or password is incorrect.", undefined, formValues(formData));
  }

  // Signing in is not enough: the account must be listed in admin_users.
  const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!adminRow) {
    await supabase.auth.signOut();
    return errorState("This account is not an administrator of the directory.", undefined, formValues(formData));
  }

  redirect(safeAdminRedirect(formString(formData, "next")));
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
