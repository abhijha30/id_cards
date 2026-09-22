"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/admin/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SOCIAL_PLATFORMS } from "@/lib/social";
import { IDLE, stateKey, type ActionState } from "@/lib/validation/common";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  teams: { id: string; name: string; slug: string }[];
};

export function TeamUploadForm({ action, teams }: Props) {
  const [state, formAction] = useActionState(action, IDLE);

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const echoed = state.status === "error" ? state.values : undefined;
  const text = (name: string, fallback: string) => echoed?.[name] ?? fallback;
  const err = (name: string) => errors[name];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div key={stateKey(state)} className="space-y-6">
        <div>
          <label htmlFor="full_name" className="field-label">Full name</label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            defaultValue={text("full_name", "")}
            className="input"
            aria-invalid={Boolean(err("full_name"))}
          />
          {err("full_name") && <p className="field-error">{err("full_name")}</p>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="public_role" className="field-label">Your role</label>
            <input id="public_role" name="public_role" type="text" maxLength={100} defaultValue={text("public_role", "")} className="input" />
          </div>
          <div>
            <label htmlFor="team_id" className="field-label">Team</label>
            <select id="team_id" name="team_id" defaultValue={text("team_id", "")} className="input">
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="bio" className="field-label">Short bio</label>
          <textarea id="bio" name="bio" maxLength={600} defaultValue={text("bio", "")} className="input" />
        </div>

        <div>
          <label htmlFor="skills" className="field-label">Skills</label>
          <input id="skills" name="skills" type="text" defaultValue={text("skills", "")} className="input" aria-invalid={Boolean(err("skills"))} />
          {err("skills") && <p className="field-error">{err("skills")}</p>}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Social links (optional)</h2>
          {SOCIAL_PLATFORMS.map((platform) => {
            const urlId = `social_${platform.key}_url`;
            return (
              <div key={platform.key}>
                <label htmlFor={urlId} className="field-label">{platform.label}</label>
                <input
                  id={urlId}
                  name={urlId}
                  type="url"
                  placeholder={platform.placeholder}
                  defaultValue={text(urlId, "")}
                  className="input"
                  aria-invalid={Boolean(err(urlId))}
                />
                {err(urlId) && <p className="field-error">{err(urlId)}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <FormMessage state={state} />
        <SubmitButton>Submit for review</SubmitButton>
      </div>
    </form>
  );
}
