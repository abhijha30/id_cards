import { z } from "zod";
import { SOCIAL_PLATFORMS, normalizeSocialUrl, type SocialLinks } from "@/lib/social";
import { formString, issuesToFieldErrors, type FieldErrors } from "@/lib/validation/common";
import { parseSkills } from "@/lib/validation/volunteer";

const MAX_SKILLS = 15;
const MAX_SKILL_LENGTH = 40;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(max, `${label} must be ${max} characters or fewer.`))
    .transform((v) => (v === "" ? null : v));

const rawTeamSchema = z.object({
  full_name: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "Enter your full name (at least 2 characters).").max(100, "The name must be 100 characters or fewer.")),
  public_role: optionalText(100, "The role"),
  bio: optionalText(600, "The bio"),
  skills: z.string().max(1000, "The skills list is too long."),
});

export type TeamSubmissionInput = {
  full_name: string;
  public_role: string | null;
  bio: string | null;
  skills: string[];
  social_links: SocialLinks;
};

export type TeamSubmissionParseResult =
  | { ok: true; data: TeamSubmissionInput }
  | { ok: false; fieldErrors: FieldErrors };

/**
 * Same rules as the admin volunteer form, minus admin-only fields (consent, publish).
 * A team member's own social links default to shown (approved: true) — they are
 * choosing what to share about themselves, unlike an admin curating someone else's links.
 */
export function parseTeamSubmissionForm(formData: FormData): TeamSubmissionParseResult {
  const raw = {
    full_name: formString(formData, "full_name"),
    public_role: formString(formData, "public_role"),
    bio: formString(formData, "bio"),
    skills: formString(formData, "skills"),
  };

  const parsed = rawTeamSchema.safeParse(raw);
  const fieldErrors: FieldErrors = parsed.success ? {} : issuesToFieldErrors(parsed.error.issues);

  const skills = parseSkills(formString(formData, "skills"));
  if (skills.length > MAX_SKILLS) {
    fieldErrors.skills = `Add at most ${MAX_SKILLS} skills.`;
  } else if (skills.some((s) => s.length > MAX_SKILL_LENGTH)) {
    fieldErrors.skills = `Each skill must be ${MAX_SKILL_LENGTH} characters or fewer.`;
  }

  const socialLinks: SocialLinks = {};
  for (const p of SOCIAL_PLATFORMS) {
    const urlText = formString(formData, `social_${p.key}_url`).trim();
    if (!urlText) continue;
    const result = normalizeSocialUrl(p.key, urlText);
    if (!result.ok) {
      fieldErrors[`social_${p.key}_url`] = result.error;
      continue;
    }
    socialLinks[p.key] = { url: result.url, approved: true };
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      full_name: parsed.data.full_name,
      public_role: parsed.data.public_role,
      bio: parsed.data.bio,
      skills,
      social_links: socialLinks,
    },
  };
}
