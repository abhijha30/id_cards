import { z } from "zod";
import { formCheckbox, formString, issuesToFieldErrors, type FieldErrors } from "@/lib/validation/common";

const teamSchema = z.object({
  name: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Enter a team name (at least 2 characters).")
        .max(60, "The team name must be 60 characters or fewer."),
    ),
  description: z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(z.string().max(300, "The description must be 300 characters or fewer."))
    .transform((v) => (v === "" ? null : v)),
  is_active: z.boolean(),
});

export type TeamInput = z.infer<typeof teamSchema>;

export type TeamParseResult = { ok: true; data: TeamInput } | { ok: false; fieldErrors: FieldErrors };

export function parseTeamForm(formData: FormData): TeamParseResult {
  const parsed = teamSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    is_active: formCheckbox(formData, "is_active"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  return { ok: true, data: parsed.data };
}
