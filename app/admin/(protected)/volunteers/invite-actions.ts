"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { adminUrlWith } from "@/lib/admin-messages";
import { CONSENT_VERSION } from "@/lib/config";
import { generateInviteToken, inviteExpiryFromNow, inviteUrl, type InviteType } from "@/lib/team-invites";
import { getSiteUrlStatus } from "@/lib/site-url";
import { formString, isUuid } from "@/lib/validation/common";

type GenerateResult = { ok: true; url: string } | { ok: false; error: string };

async function createInvite(type: InviteType, volunteerId: string | null): Promise<GenerateResult> {
  const { supabase } = await requireAdmin();
  const site = getSiteUrlStatus();
  if (!site.url) return { ok: false, error: "Set NEXT_PUBLIC_SITE_URL before generating links." };

  const { rawToken, tokenHash } = await generateInviteToken();
  const { error } = await supabase.from("team_invites").insert({
    token_hash: tokenHash,
    type,
    volunteer_id: volunteerId,
    expires_at: inviteExpiryFromNow(),
  });
  if (error) {
    console.error("createInvite failed", error);
    return { ok: false, error: "The link could not be created. Try again." };
  }

  revalidatePath("/admin/volunteers");
  if (volunteerId) revalidatePath(`/admin/volunteers/${volunteerId}/edit`);
  return { ok: true, url: inviteUrl(type, rawToken, site.url) };
}

/** New-profile link, shown on the volunteers list. */
export async function generateUploadLink(): Promise<GenerateResult> {
  return createInvite("upload", null);
}

/** Update link for one specific, already-existing volunteer. */
export async function generateUpdateLink(volunteerId: string): Promise<GenerateResult> {
  if (!isUuid(volunteerId)) return { ok: false, error: "This volunteer could not be found." };
  return createInvite("update", volunteerId);
}

/** Approves a team-submitted profile (submission_status: pending -> approved) and publishes it. */
export async function approveSubmission(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith("/admin/volunteers", { error: "not-found" }));

  const { error } = await supabase
    .from("volunteers")
    .update({
      submission_status: "approved",
      is_published: true,
      consent_status: "granted",
      consent_recorded_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
    })
    .eq("id", id);
  if (error) {
    console.error("approveSubmission failed", error);
    redirect(adminUrlWith("/admin/volunteers", { error: "failed" }));
  }
  revalidatePath("/admin/volunteers");
  revalidatePath("/admin");
  redirect(adminUrlWith("/admin/volunteers", { notice: "published" }));
}

/** Rejects a team-submitted profile. It stays hidden; nothing is deleted. */
export async function rejectSubmission(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith("/admin/volunteers", { error: "not-found" }));

  const { error } = await supabase.from("volunteers").update({ submission_status: "rejected", is_published: false }).eq("id", id);
  if (error) {
    console.error("rejectSubmission failed", error);
    redirect(adminUrlWith("/admin/volunteers", { error: "failed" }));
  }
  revalidatePath("/admin/volunteers");
  redirect(adminUrlWith("/admin/volunteers", { notice: "saved" }));
}

type PendingChanges = {
  full_name?: string;
  public_role?: string | null;
  bio?: string | null;
  skills?: string[];
  social_links?: unknown;
};

/** Applies a team member's edit (submitted through an update link) to the live profile. */
export async function approvePendingChanges(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith("/admin/volunteers", { error: "not-found" }));

  const { data: volunteer } = await supabase.from("volunteers").select("pending_changes").eq("id", id).maybeSingle();
  const changes = volunteer?.pending_changes as PendingChanges | null;
  if (!changes) redirect(adminUrlWith(`/admin/volunteers/${id}/edit`, { error: "not-found" }));

  const { error } = await supabase
    .from("volunteers")
    .update({
      ...(changes.full_name !== undefined ? { full_name: changes.full_name } : {}),
      public_role: changes.public_role ?? null,
      bio: changes.bio ?? null,
      ...(changes.skills !== undefined ? { skills: changes.skills } : {}),
      ...(changes.social_links !== undefined ? { social_links: changes.social_links } : {}),
      pending_changes: null,
      submission_status: "approved",
    })
    .eq("id", id);
  if (error) {
    console.error("approvePendingChanges failed", error);
    redirect(adminUrlWith(`/admin/volunteers/${id}/edit`, { error: "failed" }));
  }
  revalidatePath(`/admin/volunteers/${id}/edit`);
  revalidatePath("/admin/volunteers");
  redirect(adminUrlWith(`/admin/volunteers/${id}/edit`, { notice: "saved" }));
}

/** Discards a team member's proposed edit. The live, public profile is untouched. */
export async function discardPendingChanges(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith("/admin/volunteers", { error: "not-found" }));

  const { data: volunteer } = await supabase.from("volunteers").select("submission_status").eq("id", id).maybeSingle();
  // update-pending only ever happens to a profile that was already approved and live, so
  // discarding restores that, rather than leaving it stuck in a review state forever.
  const restored = volunteer?.submission_status === "update-pending" ? "approved" : volunteer?.submission_status;

  const { error } = await supabase.from("volunteers").update({ pending_changes: null, submission_status: restored }).eq("id", id);
  if (error) {
    console.error("discardPendingChanges failed", error);
    redirect(adminUrlWith(`/admin/volunteers/${id}/edit`, { error: "failed" }));
  }
  revalidatePath(`/admin/volunteers/${id}/edit`);
  redirect(adminUrlWith(`/admin/volunteers/${id}/edit`, { notice: "saved" }));
}
