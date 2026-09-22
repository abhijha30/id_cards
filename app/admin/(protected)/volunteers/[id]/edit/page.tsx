import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/admin/Notice";
import { ConsentBadge, PublishedBadge, SubmissionStatusBadge } from "@/components/admin/StatusBadges";
import { InviteLinkPanel } from "@/components/admin/InviteLinkPanel";
import { PendingChangesPanel } from "@/components/admin/PendingChangesPanel";
import { VolunteerForm } from "@/components/admin/VolunteerForm";
import { PhotoUploader } from "@/components/uploader/PhotoUploader";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminVolunteer, listTeamOptions, signPhotoUrls } from "@/lib/data/admin";
import { deleteVolunteer, updateVolunteer } from "../../actions";
import { approveSubmission, generateUpdateLink, rejectSubmission } from "../../invite-actions";

export const metadata = { title: "Edit volunteer" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditVolunteerPage({ params, searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const volunteer = await getAdminVolunteer(supabase, id);
  if (!volunteer) notFound();

  const [teams, photoUrls] = await Promise.all([
    listTeamOptions(supabase),
    signPhotoUrls(supabase, volunteer.photoPath ? [volunteer.photoPath] : []),
  ]);
  const photoUrl = volunteer.photoPath ? (photoUrls[volunteer.photoPath] ?? null) : null;
  const boundGenerateUpdateLink = generateUpdateLink.bind(null, volunteer.id);
  const pendingChanges = volunteer.pendingChanges as
    | { full_name?: string; public_role?: string | null; bio?: string | null; skills?: string[] }
    | null;

  return (
    <div>
      <Link href="/admin/volunteers" className="btn btn-quiet btn-sm -ml-3 mb-4">
        All volunteers
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{volunteer.fullName}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <PublishedBadge published={volunteer.isPublished} />
            <ConsentBadge status={volunteer.consentStatus} />
            <SubmissionStatusBadge status={volunteer.submissionStatus} />
          </div>
        </div>
        {volunteer.isPublished && (
          <Link href={`/volunteer/${volunteer.slug}`} className="btn" target="_blank" rel="noopener">
            View public profile<span className="sr-only"> (opens in a new tab)</span>
          </Link>
        )}
      </div>

      <Notice notice={sp.notice} error={sp.error} />

      {volunteer.submissionStatus === "pending" && (
        <section aria-labelledby="review-heading" className="mb-8 rounded-[1.25rem] border border-g-yellow/40 bg-g-yellow/5 p-6">
          <h2 id="review-heading" className="text-xl font-semibold">
            Submitted by a team member, awaiting your review
          </h2>
          <p className="mb-4 mt-1 text-sm text-mist">Check the details below, then approve to publish it or reject to keep it hidden.</p>
          <div className="flex flex-wrap gap-3">
            <form action={approveSubmission}>
              <input type="hidden" name="id" value={volunteer.id} />
              <SubmitButton className="btn btn-primary" pendingLabel="Working...">
                Approve and publish
              </SubmitButton>
            </form>
            <form action={rejectSubmission}>
              <input type="hidden" name="id" value={volunteer.id} />
              <SubmitButton className="btn" pendingLabel="Working...">
                Reject
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      {pendingChanges && (
        <div className="mb-8">
          <PendingChangesPanel
            volunteerId={volunteer.id}
            current={{ fullName: volunteer.fullName, publicRole: volunteer.publicRole, bio: volunteer.bio, skills: volunteer.skills }}
            pending={pendingChanges}
          />
        </div>
      )}

      <section aria-labelledby="invite-heading" className="panel mb-8 p-5">
        <h2 id="invite-heading" className="text-lg font-semibold">
          Update link for this volunteer
        </h2>
        <p className="mt-1 text-sm text-mist">
          Send this to let {volunteer.fullName} update their own details. Their change waits for your approval above before it goes
          live.
        </p>
        <div className="mt-3">
          <InviteLinkPanel label="Generate update link" generate={boundGenerateUpdateLink} />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <aside>
          <PhotoUploader volunteerId={volunteer.id} volunteerName={volunteer.fullName} currentPhotoUrl={photoUrl} />
        </aside>

        <div className="max-w-3xl space-y-10">
          <VolunteerForm
            mode="edit"
            action={updateVolunteer}
            teams={teams}
            initial={{
              id: volunteer.id,
              fullName: volunteer.fullName,
              teamId: volunteer.teamId,
              publicRole: volunteer.publicRole,
              bio: volunteer.bio,
              skills: volunteer.skills,
              consentStatus: volunteer.consentStatus,
              isPublished: volunteer.isPublished,
              socialLinks: volunteer.socialLinks,
              consentRecordedAt: volunteer.consentRecordedAt,
              consentVersion: volunteer.consentVersion,
            }}
          />

          <section aria-labelledby="danger-heading" className="rounded-[1.25rem] border border-danger/30 p-6">
            <h2 id="danger-heading" className="text-xl font-semibold">
              Delete this volunteer
            </h2>
            <p className="mb-4 mt-1 text-sm text-mist">
              Permanently removes the profile and its photo. To hide the profile without deleting it, untick &ldquo;Publish this
              profile&rdquo; above.
            </p>
            <ConfirmAction
              triggerLabel="Delete volunteer"
              title={`Delete ${volunteer.fullName}?`}
              description="This cannot be undone. The profile and its photo will be removed."
              confirmLabel="Delete volunteer"
              action={deleteVolunteer}
              fields={{ id: volunteer.id }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
