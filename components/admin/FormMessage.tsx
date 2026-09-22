import type { ActionState } from "@/lib/validation/common";

export const NOTICES = {
  created: "Volunteer created. Add a photo below, then publish when consent is recorded.",
  saved: "Changes saved.",
  deleted: "Volunteer deleted.",
  published: "Profile published. It is now visible in the public directory.",
  unpublished: "Profile unpublished. It is no longer visible to the public.",
  "team-saved": "Team saved.",
  "team-deleted": "Team deleted.",
  "team-updated": "Team updated.",
  "invite-revoked": "The link was revoked.",
  "submission-approved": "Submission approved.",
  "submission-rejected": "Submission rejected.",
} as const;

/** Result banner for a form action. Errors use role=alert so screen readers announce them. */

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;

  const isError = state.status === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        isError
          ? "border-danger/50 bg-danger/10 text-danger"
          : "border-ok/50 bg-ok/10 text-ok"
      }`}
    >
      {state.message}
    </p>
  );
}
