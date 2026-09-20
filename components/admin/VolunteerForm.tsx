"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/admin/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/social";
import { IDLE, stateKey, type ActionState } from "@/lib/validation/common";
import { CONSENT_LABELS, CONSENT_STATUSES, type ConsentStatus } from "@/lib/validation/volunteer";

export type VolunteerFormInitial = {
  id: string;
  fullName: string;
  teamId: string | null;
  publicRole: string | null;
  bio: string | null;
  skills: string[];
  consentStatus: ConsentStatus;
  isPublished: boolean;
  socialLinks: SocialLinks;
  consentRecordedAt: string | null;
  consentVersion: string | null;
};

type Props = {
  mode: "create" | "edit";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  teams: { id: string; name: string; isActive: boolean }[];
  initial?: VolunteerFormInitial;
};

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function VolunteerForm({ mode, action, teams, initial }: Props) {
  const [state, formAction] = useActionState(action, IDLE);

  const echoed = state.status === "error" ? state.values : undefined;
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const text = (name: string, fallback: string) => echoed?.[name] ?? fallback;
  const bool = (name: string, fallback: boolean) => (echoed ? name in echoed : fallback);

  const err = (name: string) => errors[name];

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <div key={stateKey(state)} className="space-y-8">
        {mode === "edit" && initial && <input type="hidden" name="id" value={initial.id} />}

        <section className="panel space-y-5 p-6" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xl font-semibold">
            Public profile
          </h2>

          <Field id="full_name" label="Full name" error={err("full_name")}>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              maxLength={100}
              autoComplete="off"
              defaultValue={text("full_name", initial?.fullName ?? "")}
              aria-invalid={Boolean(err("full_name"))}
              aria-describedby={describedBy("full_name", undefined, err("full_name"))}
              className="input"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="public_role" label="Public role" hint="For example: Workshop lead. Optional." error={err("public_role")}>
              <input
                id="public_role"
                name="public_role"
                type="text"
                maxLength={100}
                defaultValue={text("public_role", initial?.publicRole ?? "")}
                aria-invalid={Boolean(err("public_role"))}
                aria-describedby={describedBy("public_role", "x", err("public_role"))}
                className="input"
              />
            </Field>

            <Field id="team_id" label="Team" error={err("team_id")}>
              <select
                id="team_id"
                name="team_id"
                defaultValue={text("team_id", initial?.teamId ?? "")}
                className="input"
                aria-invalid={Boolean(err("team_id"))}
              >
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                    {team.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field id="bio" label="Short bio" hint="Up to 600 characters. Shown on the public profile." error={err("bio")}>
            <textarea
              id="bio"
              name="bio"
              maxLength={600}
              defaultValue={text("bio", initial?.bio ?? "")}
              aria-invalid={Boolean(err("bio"))}
              aria-describedby={describedBy("bio", "x", err("bio"))}
              className="input"
            />
          </Field>

          <Field id="skills" label="Skills" hint="Separate with commas. Up to 15 skills, 40 characters each." error={err("skills")}>
            <input
              id="skills"
              name="skills"
              type="text"
              defaultValue={text("skills", initial?.skills.join(", ") ?? "")}
              aria-invalid={Boolean(err("skills"))}
              aria-describedby={describedBy("skills", "x", err("skills"))}
              className="input"
            />
          </Field>
        </section>

        <section className="panel space-y-5 p-6" aria-labelledby="social-heading">
          <div>
            <h2 id="social-heading" className="text-xl font-semibold">
              Social links
            </h2>
            <p className="mt-1 text-sm text-mist">
              A link is shown publicly only when its box is ticked. Untick to keep a link on file without showing it.
            </p>
          </div>

          {SOCIAL_PLATFORMS.map((platform) => {
            const urlId = `social_${platform.key}_url`;
            const approvedId = `social_${platform.key}_approved`;
            const existing = initial?.socialLinks[platform.key];
            const error = err(urlId);
            return (
              <div key={platform.key}>
                <label htmlFor={urlId} className="field-label">
                  {platform.label}
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    id={urlId}
                    name={urlId}
                    type="url"
                    inputMode="url"
                    placeholder={platform.placeholder}
                    defaultValue={text(urlId, existing?.url ?? "")}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${urlId}-error` : undefined}
                    className="input sm:flex-1"
                  />
                  <label className="flex shrink-0 items-center gap-2 text-sm text-mist">
                    <input
                      type="checkbox"
                      name={approvedId}
                      className="check"
                      defaultChecked={bool(approvedId, existing?.approved ?? false)}
                    />
                    Show on public profile
                  </label>
                </div>
                {error && (
                  <p id={`${urlId}-error`} className="field-error">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        <section className="panel space-y-5 p-6" aria-labelledby="consent-heading">
          <h2 id="consent-heading" className="text-xl font-semibold">
            Consent and visibility
          </h2>

          <Field
            id="consent_status"
            label="Consent to be listed"
            hint="Choose Granted only after the volunteer has agreed to appear in the public directory."
            error={err("consent_status")}
          >
            <select
              id="consent_status"
              name="consent_status"
              defaultValue={text("consent_status", initial?.consentStatus ?? "pending")}
              className="input"
              aria-describedby={describedBy("consent_status", "x", err("consent_status"))}
            >
              {CONSENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CONSENT_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>

          {mode === "edit" && initial?.consentRecordedAt && (
            <p className="text-sm text-dim">
              Last recorded {new Date(initial.consentRecordedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              {initial.consentVersion ? ` under notice version ${initial.consentVersion}` : ""}.
            </p>
          )}

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="is_published"
              className="check mt-1"
              defaultChecked={bool("is_published", initial?.isPublished ?? false)}
            />
            <span>
              <span className="block font-semibold">Publish this profile</span>
              <span className="block text-sm text-mist">
                Makes the profile visible to anyone with the directory link. Requires consent to be Granted; otherwise the profile is saved
                as unpublished.
              </span>
            </span>
          </label>
        </section>
      </div>

      <div className="space-y-4">
        <FormMessage state={state} />
        <SubmitButton>{mode === "create" ? "Create volunteer" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
