"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/admin/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE, stateKey, type ActionState } from "@/lib/validation/common";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  team?: { id: string; name: string; description: string | null; isActive: boolean };
};

export function TeamForm({ action, team }: Props) {
  const [state, formAction] = useActionState(action, IDLE);
  const echoed = state.status === "error" ? state.values : undefined;
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const key = team?.id ?? "new";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div key={stateKey(state)} className="space-y-4">
        {team && <input type="hidden" name="id" value={team.id} />}
        <div>
          <label htmlFor={`name-${key}`} className="field-label">
            Team name
          </label>
          <input
            id={`name-${key}`}
            name="name"
            type="text"
            required
            maxLength={60}
            defaultValue={echoed?.name ?? team?.name ?? ""}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `name-${key}-error` : undefined}
            className="input"
          />
          {errors.name && (
            <p id={`name-${key}-error`} className="field-error">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`description-${key}`} className="field-label">
            Description (optional)
          </label>
          <textarea
            id={`description-${key}`}
            name="description"
            maxLength={300}
            defaultValue={echoed?.description ?? team?.description ?? ""}
            aria-invalid={Boolean(errors.description)}
            className="input"
            style={{ minHeight: "5rem" }}
          />
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="is_active"
            className="check"
            defaultChecked={echoed ? "is_active" in echoed : (team?.isActive ?? true)}
          />
          <span>
            <span className="font-semibold">Active</span>
            <span className="text-mist"> (inactive teams are hidden from the public filter)</span>
          </span>
        </label>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{team ? "Save team" : "Add team"}</SubmitButton>
    </form>
  );
}
