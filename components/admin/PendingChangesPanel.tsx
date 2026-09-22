import { SubmitButton } from "@/components/ui/SubmitButton";
import { approvePendingChanges, discardPendingChanges } from "@/app/admin/(protected)/volunteers/invite-actions";

type Props = {
  volunteerId: string;
  current: { fullName: string; publicRole: string | null; bio: string | null; skills: string[] };
  pending: { full_name?: string; public_role?: string | null; bio?: string | null; skills?: string[] };
};

function Row({ label, before, after }: { label: string; before: string; after: string }) {
  if (before === after) return null;
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[8rem_1fr]">
      <span className="text-sm font-semibold text-mist">{label}</span>
      <div className="text-sm">
        <p className="text-dim line-through">{before || "(empty)"}</p>
        <p className="text-fog">{after || "(empty)"}</p>
      </div>
    </div>
  );
}

/** Shows a team member's proposed edit next to the live values, before it is applied. */
export function PendingChangesPanel({ volunteerId, current, pending }: Props) {
  return (
    <section aria-labelledby="pending-heading" className="rounded-[1.25rem] border border-g-yellow/40 bg-g-yellow/5 p-6">
      <h2 id="pending-heading" className="text-xl font-semibold">
        Edit submitted by the volunteer, awaiting your review
      </h2>
      <p className="mt-1 text-sm text-mist">
        The public profile still shows the version below on the left. Approve to publish the change, or discard it to keep the current
        version.
      </p>

      <div className="mt-4">
        <Row label="Name" before={current.fullName} after={pending.full_name ?? current.fullName} />
        <Row label="Role" before={current.publicRole ?? ""} after={pending.public_role ?? current.publicRole ?? ""} />
        <Row label="Bio" before={current.bio ?? ""} after={pending.bio ?? current.bio ?? ""} />
        <Row label="Skills" before={current.skills.join(", ")} after={(pending.skills ?? current.skills).join(", ")} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <form action={approvePendingChanges}>
          <input type="hidden" name="id" value={volunteerId} />
          <SubmitButton className="btn btn-primary" pendingLabel="Applying...">
            Approve this change
          </SubmitButton>
        </form>
        <form action={discardPendingChanges}>
          <input type="hidden" name="id" value={volunteerId} />
          <SubmitButton className="btn" pendingLabel="Discarding...">
            Discard change
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
