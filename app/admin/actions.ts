"use server";

import { generateInviteToken, inviteExpiryFromNow, inviteUrl } from "@/lib/team-invites";
import { getSiteUrlStatus } from "@/lib/site-url";
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
export type InviteActionResult = { ok: true; url: string } | { ok: false; error: string };

/** Generates a new team-upload link. Shown once; only the token's hash is stored. */
export async function createUploadInvite(): Promise<InviteActionResult> {
  const { supabase, user } = await requireAdmin();
  const site = getSiteUrlStatus();
  if (!site.url) return { ok: false, error: "Set NEXT_PUBLIC_SITE_URL before generating links." };

  const { rawToken, tokenHash } = await generateInviteToken();
  const { error } = await supabase.from("team_invites").insert({
    token_hash: tokenHash,
    type: "upload",
    expires_at: inviteExpiryFromNow(),
    created_by: user.id,
  });
  if (error) {
    console.error("createUploadInvite failed", error);
    return { ok: false, error: "Could not create the link. Try again." };
  }
  return { ok: true, url: inviteUrl("upload", rawToken, site.url) };
}

/** Generates a team-update link scoped to one existing volunteer. */
export async function createUpdateInvite(volunteerId: string): Promise<InviteActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!isUuid(volunteerId)) return { ok: false, error: "This volunteer could not be found." };
  const site = getSiteUrlStatus();
  if (!site.url) return { ok: false, error: "Set NEXT_PUBLIC_SITE_URL before generating links." };

  const { rawToken, tokenHash } = await generateInviteToken();
  const { error } = await supabase.from("team_invites").insert({
    token_hash: tokenHash,
    type: "update",
    volunteer_id: volunteerId,
    expires_at: inviteExpiryFromNow(),
    created_by: user.id,
  });
  if (error) {
    console.error("createUpdateInvite failed", error);
    return { ok: false, error: "Could not create the link. Try again." };
  }
  return { ok: true, url: inviteUrl("update", rawToken, site.url) };
}

/** Revokes an invite before it expires or is used. */
export async function revokeInvite(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const returnTo = formString(formData, "returnTo") || "/admin/volunteers";
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith(returnTo, { error: "not-found" }));

  const { error } = await supabase.from("team_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("revokeInvite failed", error);
    redirect(adminUrlWith(returnTo, { error: "failed" }));
  }
  redirect(adminUrlWith(returnTo, { notice: "invite-revoked" }));
}

/** Approves a pending submission, or a pending update (merging its staged changes live). */
export async function approveSubmission(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const returnTo = formString(formData, "returnTo") || "/admin/volunteers";
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith(returnTo, { error: "not-found" }));

  const { data: existing, error: readError } = await supabase
    .from("volunteers")
    .select("submission_status, pending_changes, consent_status")
    .eq("id", id)
    .maybeSingle();
  if (readError || !existing) redirect(adminUrlWith(returnTo, { error: "not-found" }));

  const row = existing as { submission_status: string; pending_changes: Record<string, unknown> | null; consent_status: string };

  if (row.submission_status === "update-pending" && row.pending_changes) {
    const draft = row.pending_changes as {
      full_name: string;
      public_role: string | null;
      bio: string | null;
      skills: string[];
      social_links: Record<string, unknown>;
    };
    const { error } = await supabase
      .from("volunteers")
      .update({
        full_name: draft.full_name,
        public_role: draft.public_role,
        bio: draft.bio,
        skills: draft.skills,
        social_links: draft.social_links,
        submission_status: "approved",
        pending_changes: null,
      })
      .eq("id", id);
    if (error) {
      console.error("approveSubmission (update) failed", error);
      redirect(adminUrlWith(returnTo, { error: "failed" }));
    }
  } else {
    if (row.consent_status !== "granted") redirect(adminUrlWith(returnTo, { error: "consent-required" }));
    const { error } = await supabase.from("volunteers").update({ submission_status: "approved" }).eq("id", id);
    if (error) {
      console.error("approveSubmission failed", error);
      redirect(adminUrlWith(returnTo, { error: "failed" }));
    }
  }
  revalidatePath("/admin/volunteers");
  redirect(adminUrlWith(returnTo, { notice: "submission-approved" }));
}

/** Rejects a pending submission or discards a pending update's staged draft. */
export async function rejectSubmission(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const returnTo = formString(formData, "returnTo") || "/admin/volunteers";
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith(returnTo, { error: "not-found" }));

  const { data: existing } = await supabase.from("volunteers").select("submission_status").eq("id", id).maybeSingle();
  if (!existing) redirect(adminUrlWith(returnTo, { error: "not-found" }));

  const wasUpdate = (existing as { submission_status: string }).submission_status === "update-pending";
  const { error } = await supabase
    .from("volunteers")
    .update(
      wasUpdate ? { submission_status: "approved", pending_changes: null } : { submission_status: "rejected", is_published: false },
    )
    .eq("id", id);
  if (error) {
    console.error("rejectSubmission failed", error);
    redirect(adminUrlWith(returnTo, { error: "failed" }));
  }
  revalidatePath("/admin/volunteers");
  redirect(adminUrlWith(returnTo, { notice: "submission-rejected" }));
}
