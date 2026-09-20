import { z } from "zod";
import { SOCIAL_PLATFORMS, normalizeSocialUrl, type SocialLinks } from "@/lib/social";
import {
  UUID_PATTERN,
  formCheckbox,
  formString,
  issuesToFieldErrors,
  type FieldErrors,
} from "@/lib/validation/common";

export const CONSENT_STATUSES = ["pending", "granted", "withdrawn"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSENT_LABELS: Record<ConsentStatus, string> = {
  pending: "Not yet recorded",
  granted: "Granted",
  withdrawn: "Withdrawn",
};

const MAX_SKILLS = 15;
const MAX_SKILL_LENGTH = 40;

/** "React, Design; Public speaking" (or one per line) -> ["React", "Design", "Public speaking"] */
export function parseSkills(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const skill = part.replace(/\s+/g, " ").trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(max, `${label} must be ${max} characters or fewer.`))
    .transform((v) => (v === "" ? null : v));

const rawVolunteerSchema = z.object({
  full_name: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Enter the volunteer's full name (at least 2 characters).")
        .max(100, "The name must be 100 characters or fewer."),
    ),
  team_id: z
    .string()
    .trim()
    .refine((v) => v === "" || UUID_PATTERN.test(v), "Choose a team from the list.")
    .transform((v) => (v === "" ? null : v)),
  public_role: optionalText(100, "The role"),
  bio: optionalText(600, "The bio"),
  skills: z.string().max(1000, "The skills list is too long."),
  consent_status: z.enum(CONSENT_STATUSES, { error: "Choose a consent status." }),
  is_published: z.boolean(),
});

export type VolunteerInput = {
  full_name: string;
  team_id: string | null;
  public_role: string | null;
  bio: string | null;
  skills: string[];
  consent_status: ConsentStatus;
  is_published: boolean;
  social_links: SocialLinks;
};

export type VolunteerParseResult =
  | { ok: true; data: VolunteerInput; notice?: string }
  | { ok: false; fieldErrors: FieldErrors };

/** Reads and validates the admin volunteer form. Returns cleaned data or field-level errors. */
export function parseVolunteerForm(formData: FormData): VolunteerParseResult {
  const raw = {
    full_name: formString(formData, "full_name"),
    team_id: formString(formData, "team_id"),
    public_role: formString(formData, "public_role"),
    bio: formString(formData, "bio"),
    skills: formString(formData, "skills"),
    consent_status: formString(formData, "consent_status") || "pending",
    is_published: formCheckbox(formData, "is_published"),
  };

  // Social links are validated per platform below (host allow-lists, https-only).
  const parsed = rawVolunteerSchema.safeParse(raw);
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
    socialLinks[p.key] = { url: result.url, approved: formCheckbox(formData, `social_${p.key}_approved`) };
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  // Privacy rule: a profile can only be public while consent is granted. Withdrawing consent
  // must always take the profile down, even if the "published" box is still ticked.
  let isPublished = parsed.data.is_published;
  let notice: string | undefined;
  if (isPublished && parsed.data.consent_status !== "granted") {
    isPublished = false;
    notice = "The profile was saved as unpublished because consent is not marked as granted.";
  }

  return {
    ok: true,
    notice,
    data: {
      full_name: parsed.data.full_name,
      team_id: parsed.data.team_id,
      public_role: parsed.data.public_role,
      bio: parsed.data.bio,
      skills,
      consent_status: parsed.data.consent_status,
      is_published: isPublished,
      social_links: socialLinks,
    },
  };
}
