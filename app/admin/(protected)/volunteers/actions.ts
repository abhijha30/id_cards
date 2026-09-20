"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { adminUrlWith } from "@/lib/admin-messages";
import { CONSENT_VERSION, MAX_PHOTO_BYTES, PHOTO_BUCKET } from "@/lib/config";
import { slugCandidates, slugify } from "@/lib/utils/slug";
import { errorState, formString, formValues, isUuid, successState, type ActionState } from "@/lib/validation/common";
import { isPhotoMime, isPhotoPathFor } from "@/lib/validation/photo";
import { parseVolunteerForm, type ConsentStatus, type VolunteerInput } from "@/lib/validation/volunteer";

const GENERIC_SAVE_ERROR = "The volunteer could not be saved. Check the values and try again.";

type ExistingConsent = { consent_status: ConsentStatus; consent_recorded_at: string | null; consent_version: string | null };

/** Consent bookkeeping: record WHEN the status changed and WHICH notice version was agreed to. */
function consentColumns(next: ConsentStatus, existing: ExistingConsent | null) {
  const unchanged = existing !== null && existing.consent_status === next;
  if (unchanged) {
    return { consent_recorded_at: existing.consent_recorded_at, consent_version: existing.consent_version };
  }
  if (next === "pending") return { consent_recorded_at: null, consent_version: null };
  return {
    consent_recorded_at: new Date().toISOString(),
    consent_version: next === "granted" ? CONSENT_VERSION : (existing?.consent_version ?? null),
  };
}

function volunteerColumns(data: VolunteerInput, existing: ExistingConsent | null) {
  return {
    full_name: data.full_name,
    team_id: data.team_id,
    public_role: data.public_role,
    bio: data.bio,
    skills: data.skills,
    social_links: data.social_links,
    is_published: data.is_published,
    consent_status: data.consent_status,
    ...consentColumns(data.consent_status, existing),
  };
}

export async function createVolunteer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();

  const parsed = parseVolunteerForm(formData);
  if (!parsed.ok) return errorState("Some fields need attention.", parsed.fieldErrors, formValues(formData));

  const columns = volunteerColumns(parsed.data, null);
  let createdId: string | null = null;

  for (const slug of slugCandidates(slugify(parsed.data.full_name, 60), "volunteer")) {
    const { data, error } = await supabase.from("volunteers").insert({ ...columns, slug }).select("id").single();
    if (!error) {
      createdId = data.id as string;
      break;
    }
    const slugTaken = error.code === "23505" && `${error.message} ${error.details ?? ""}`.includes("slug");
    if (!slugTaken) {
      console.error("createVolunteer failed", error);
      return errorState(GENERIC_SAVE_ERROR);
    }
  }

  if (!createdId) return errorState(GENERIC_SAVE_ERROR);
  redirect(`/admin/volunteers/${createdId}/edit?notice=created`);
}

export async function updateVolunteer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();

  const id = formString(formData, "id");
  if (!isUuid(id)) return errorState("This volunteer could not be found.");

  const parsed = parseVolunteerForm(formData);
  if (!parsed.ok) return errorState("Some fields need attention.", parsed.fieldErrors, formValues(formData));

  const { data: existing, error: readError } = await supabase
    .from("volunteers")
    .select("consent_status, consent_recorded_at, consent_version")
    .eq("id", id)
    .maybeSingle();
  if (readError || !existing) return errorState("This volunteer could not be found. It may have been deleted.");

  const { error } = await supabase
    .from("volunteers")
    .update(volunteerColumns(parsed.data, existing as ExistingConsent))
    .eq("id", id);
  if (error) {
    console.error("updateVolunteer failed", error);
    return errorState(GENERIC_SAVE_ERROR);
  }

  revalidatePath(`/admin/volunteers/${id}/edit`);
  revalidatePath("/admin/volunteers");
  return successState(parsed.notice ? `Changes saved. ${parsed.notice}` : "Changes saved.");
}

/** Publish / unpublish from the list or edit page. Publishing needs granted consent. */
export async function setPublished(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const returnTo = formString(formData, "returnTo") || "/admin/volunteers";
  const id = formString(formData, "id");
  const publish = formString(formData, "publish") === "true";

  if (!isUuid(id)) redirect(adminUrlWith(returnTo, { error: "not-found" }));

  const { data: existing } = await supabase.from("volunteers").select("consent_status").eq("id", id).maybeSingle();
  if (!existing) redirect(adminUrlWith(returnTo, { error: "not-found" }));
  if (publish && existing.consent_status !== "granted") {
    redirect(adminUrlWith(returnTo, { error: "consent-required" }));
  }

  const { error } = await supabase.from("volunteers").update({ is_published: publish }).eq("id", id);
  if (error) {
    console.error("setPublished failed", error);
    redirect(adminUrlWith(returnTo, { error: "failed" }));
  }
  redirect(adminUrlWith(returnTo, { notice: publish ? "published" : "unpublished" }));
}

export async function deleteVolunteer(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith("/admin/volunteers", { error: "not-found" }));

  const { data: existing } = await supabase.from("volunteers").select("photo_path").eq("id", id).maybeSingle();
  if (!existing) redirect(adminUrlWith("/admin/volunteers", { error: "not-found" }));

  const { error } = await supabase.from("volunteers").delete().eq("id", id);
  if (error) {
    console.error("deleteVolunteer failed", error);
    redirect(adminUrlWith("/admin/volunteers", { error: "failed" }));
  }

  // Remove the stored photo too; the record is already gone, so a failure here is only logged.
  const photoPath = (existing as { photo_path: string | null }).photo_path;
  if (photoPath) {
    const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    if (removeError) console.error("photo cleanup failed", removeError);
  }
  redirect(adminUrlWith("/admin/volunteers", { notice: "deleted" }));
}

export type PhotoActionResult = { ok: true } | { ok: false; error: string };

/**
 * Called by the uploader AFTER the browser has uploaded the file straight to Storage (Vercel
 * functions cap request bodies at ~4.5 MB, so files go directly). This verifies the object on
 * the server before it is attached to the volunteer.
 */
export async function attachVolunteerPhoto(volunteerId: string, path: string): Promise<PhotoActionResult> {
  const { supabase } = await requireAdmin();
  const bucket = supabase.storage.from(PHOTO_BUCKET);

  if (!isUuid(volunteerId) || typeof path !== "string" || !isPhotoPathFor(volunteerId, path)) {
    return { ok: false, error: "That photo reference is not valid." };
  }

  const { data: volunteer, error: readError } = await supabase
    .from("volunteers")
    .select("photo_path")
    .eq("id", volunteerId)
    .maybeSingle();
  if (readError || !volunteer) return { ok: false, error: "This volunteer could not be found." };

  const info = await bucket.info(path);
  if (info.error || !info.data) {
    return { ok: false, error: "The uploaded file could not be found in storage. Try uploading again." };
  }
  const contentType = info.data.contentType ?? "";
  const size = info.data.size ?? 0;
  if (!isPhotoMime(contentType) || size <= 0 || size > MAX_PHOTO_BYTES) {
    await bucket.remove([path]);
    return { ok: false, error: "The uploaded file is not an accepted image (JPEG, PNG or WebP up to 5 MB)." };
  }

  const { error: updateError } = await supabase.from("volunteers").update({ photo_path: path }).eq("id", volunteerId);
  if (updateError) {
    console.error("attachVolunteerPhoto failed", updateError);
    await bucket.remove([path]);
    return { ok: false, error: "The photo was uploaded but could not be attached to the volunteer. Try again." };
  }

  const previous = (volunteer as { photo_path: string | null }).photo_path;
  if (previous && previous !== path) {
    const { error: removeError } = await bucket.remove([previous]);
    if (removeError) console.error("previous photo cleanup failed", removeError);
  }
  return { ok: true };
}

export async function removeVolunteerPhoto(volunteerId: string): Promise<PhotoActionResult> {
  const { supabase } = await requireAdmin();
  if (!isUuid(volunteerId)) return { ok: false, error: "This volunteer could not be found." };

  const { data: volunteer, error: readError } = await supabase
    .from("volunteers")
    .select("photo_path")
    .eq("id", volunteerId)
    .maybeSingle();
  if (readError || !volunteer) return { ok: false, error: "This volunteer could not be found." };

  const path = (volunteer as { photo_path: string | null }).photo_path;
  if (!path) return { ok: true };

  const { error: updateError } = await supabase.from("volunteers").update({ photo_path: null }).eq("id", volunteerId);
  if (updateError) {
    console.error("removeVolunteerPhoto failed", updateError);
    return { ok: false, error: "The photo could not be removed. Try again." };
  }
  const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (removeError) console.error("photo object cleanup failed", removeError);
  return { ok: true };
}
