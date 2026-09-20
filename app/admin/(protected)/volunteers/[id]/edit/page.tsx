import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/admin/Notice";
import { ConsentBadge, PublishedBadge } from "@/components/admin/StatusBadges";
import { VolunteerForm } from "@/components/admin/VolunteerForm";
import { PhotoUploader } from "@/components/uploader/PhotoUploader";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminVolunteer, listTeamOptions, signPhotoUrls } from "@/lib/data/admin";
import { deleteVolunteer, updateVolunteer } from "../../actions";

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
          </div>
        </div>
        {volunteer.isPublished && (
          <Link href={`/volunteer/${volunteer.slug}`} className="btn" target="_blank" rel="noopener">
            View public profile<span className="sr-only"> (opens in a new tab)</span>
          </Link>
        )}
      </div>

      <Notice notice={sp.notice} error={sp.error} />

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
