"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { hashInviteToken, isPlausibleToken } from "@/lib/team-invites";
import { parseTeamSubmissionForm } from "@/lib/validation/team-submission";
import { errorState, formValues, successState, type ActionState } from "@/lib/validation/common";

const GENERIC_ERROR = "This could not be submitted. Check the values and try again.";
const EXPIRED_ERROR = "This link has expired or has already been used. Please contact the administrator for a new link.";

export async function submitTeamUpdate(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isPlausibleToken(token)) return errorState(EXPIRED_ERROR);

  const parsed = parseTeamSubmissionForm(formData);
  if (!parsed.ok) return errorState("Some fields need attention.", parsed.fieldErrors, formValues(formData));

  const tokenHash = await hashInviteToken(token);
  const supabase = createPublicClient();

  const { error } = await supabase.rpc("submit_team_update", {
    p_token_hash: tokenHash,
    p_full_name: parsed.data.full_name,
    p_public_role: parsed.data.public_role,
    p_bio: parsed.data.bio,
    p_skills: parsed.data.skills,
    p_social_links: parsed.data.social_links,
  });

  if (error) {
    const detail = `${error.message} ${error.details ?? ""}`;
    if (detail.includes("invalid_or_expired_token") || detail.includes("volunteer_not_found")) return errorState(EXPIRED_ERROR);
    console.error("submitTeamUpdate failed", error);
    return errorState(GENERIC_ERROR);
  }
  return successState("Thanks — your changes have been submitted and are awaiting review.");
}
