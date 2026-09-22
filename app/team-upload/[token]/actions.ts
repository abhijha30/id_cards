"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { hashInviteToken, isPlausibleToken } from "@/lib/team-invites";
import { parseTeamSubmissionForm } from "@/lib/validation/team-submission";
import { slugCandidates, slugify } from "@/lib/utils/slug";
import { errorState, formString, formValues, successState, type ActionState } from "@/lib/validation/common";

const GENERIC_ERROR = "This could not be submitted. Check the values and try again.";
const EXPIRED_ERROR = "This link has expired or has already been used. Please contact the administrator for a new link.";

export async function submitTeamUpload(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isPlausibleToken(token)) return errorState(EXPIRED_ERROR);

  const parsed = parseTeamSubmissionForm(formData);
  if (!parsed.ok) return errorState("Some fields need attention.", parsed.fieldErrors, formValues(formData));

  const teamIdRaw = formString(formData, "team_id").trim();
  const teamId = teamIdRaw === "" ? null : teamIdRaw;

  const tokenHash = await hashInviteToken(token);
  const supabase = createPublicClient();

  for (const slug of slugCandidates(slugify(parsed.data.full_name, 60), "volunteer")) {
    const { error } = await supabase.rpc("submit_team_upload", {
      p_token_hash: tokenHash,
      p_slug: slug,
      p_full_name: parsed.data.full_name,
      p_team_id: teamId,
      p_public_role: parsed.data.public_role,
      p_bio: parsed.data.bio,
      p_skills: parsed.data.skills,
      p_social_links: parsed.data.social_links,
    });
    if (!error) return successState("Thanks — your submission has been received and is awaiting review.");

    const detail = `${error.message} ${error.details ?? ""}`;
    if (error.code === "23505" && detail.includes("slug")) continue; // try the next slug candidate
    if (detail.includes("invalid_or_expired_token")) return errorState(EXPIRED_ERROR);
    console.error("submitTeamUpload failed", error);
    return errorState(GENERIC_ERROR);
  }
  return errorState(GENERIC_ERROR);
}
