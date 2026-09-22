import Link from "next/link";
import { Notice } from "@/components/admin/Notice";
import { ConsentBadge, PublishedBadge, SubmissionStatusBadge } from "@/components/admin/StatusBadges";
import { InviteLinkPanel } from "@/components/admin/InviteLinkPanel";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requireAdmin } from "@/lib/auth/admin";
import { listAdminVolunteers, listTeamOptions, signPhotoUrls, STATUS_FILTERS, type StatusFilter } from "@/lib/data/admin";
import { normalizeSearchText } from "@/lib/utils/search";
import { isUuid } from "@/lib/validation/common";
import { deleteVolunteer, setPublished } from "./volunteers/actions";
import { approveSubmission, generateUploadLink, rejectSubmission } from "./volunteers/invite-actions";
export const metadata = { title: "Volunteers" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function listHref(params: { q: string; team: string; status: string; page?: number }): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.team) search.set("team", params.team);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/admin/volunteers?${query}` : "/admin/volunteers";
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  published: "Published",
  draft: "Not published",
  "consent-missing": "Consent not granted",
  "pending-review": "Needs review",
};

export default async function AdminVolunteersPage({ searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const q = normalizeSearchText(one(sp.q));
  const teamRaw = one(sp.team);
  const team = teamRaw === "none" || isUuid(teamRaw) ? teamRaw : "";
  const statusRaw = one(sp.status);
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(statusRaw) ? (statusRaw as StatusFilter) : "all";
  const pageNumber = Number.parseInt(one(sp.page) || "1", 10);
  const page = Number.isFinite(pageNumber) ? Math.min(Math.max(pageNumber, 1), 1000) : 1;

  const [result, teams] = await Promise.all([
    listAdminVolunteers(supabase, { q, team: team || null, status, page }),
    listTeamOptions(supabase),
  ]);
  const photoUrls = await signPhotoUrls(
    supabase,
    result.volunteers.flatMap((v) => (v.photoPath ? [v.photoPath] : [])),
  );

  const returnTo = listHref({ q, team, status, page });
  const filtered = q !== "" || team !== "" || status !== "all";

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Volunteers</h1>
          <p className="mt-2 text-mist">
            {result.total} {result.total === 1 ? "volunteer" : "volunteers"}
            {filtered ? " match the current filters" : " in total"}.
          </p>
        </div>
        <Link href="/admin/volunteers/new" className="btn btn-primary">
          Add a volunteer
        </Link>
      </div>

      <section aria-labelledby="invite-heading" className="panel mb-8 p-5">
        <h2 id="invite-heading" className="text-lg font-semibold">
          Team upload link
        </h2>
        <p className="mt-1 text-sm text-mist">
          Generate a private link and send it to a team member so they can submit their own profile. Submissions need your approval
          before they appear on the public site.
        </p>
        <div className="mt-3">
          <InviteLinkPanel label="Generate upload link" generate={generateUploadLink} />
        </div>
      </section>

      <Notice notice={sp.notice} error={sp.error} />

      <form method="get" action="/admin/volunteers" role="search" className="mb-8 grid gap-3 sm:grid-cols-[1fr_12rem_12rem_auto]">
        <div>
          <label htmlFor="q" className="sr-only">
            Search by name
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name" className="input" maxLength={80} />
        </div>
        <div>
          <label htmlFor="team" className="sr-only">
            Team
          </label>
          <select id="team" name="team" defaultValue={team} className="input">
            <option value="">All teams</option>
            <option value="none">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="input">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn">
            Filter
          </button>
          {filtered && (
            <Link href="/admin/volunteers" className="btn btn-quiet">
              Clear
            </Link>
          )}
        </div>
      </form>

      {result.volunteers.length === 0 ? (
        <div className="panel p-6">
          <p className="font-semibold">{filtered ? "No volunteers match these filters." : "No volunteers yet."}</p>
          {!filtered && <p className="mt-1 text-mist">Add the first volunteer to get started.</p>}
        </div>
      ) : (
        <ul className="space-y-3">
          {result.volunteers.map((v) => {
            const photo = v.photoPath ? photoUrls[v.photoPath] : undefined;
            return (
              <li key={v.id} className="panel flex flex-wrap items-center gap-4 p-4">
                <div className="h-[4.5rem] w-14 shrink-0 overflow-hidden rounded-xl bg-coal-2">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" width={56} height={72} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-dim">No photo</div>
                  )}
                </div>

                <div className="min-w-0 flex-1 basis-56">
                  <Link href={`/admin/volunteers/${v.id}/edit`} className="text-lg font-semibold hover:underline">
                    {v.fullName}
                  </Link>
                  <p className="text-sm text-mist">{[v.team?.name, v.publicRole].filter(Boolean).join(", ") || "No team or role"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PublishedBadge published={v.isPublished} />
                    <ConsentBadge status={v.consentStatus} />
                    <SubmissionStatusBadge status={v.submissionStatus} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/volunteers/${v.id}/edit`} className="btn btn-sm">
                    Edit
                  </Link>
                  {v.submissionStatus === "pending" && (
                    <>
                      <form action={approveSubmission}>
                        <input type="hidden" name="id" value={v.id} />
                        <SubmitButton className="btn btn-sm btn-primary" pendingLabel="Working...">
                          Approve
                        </SubmitButton>
                      </form>
                      <form action={rejectSubmission}>
                        <input type="hidden" name="id" value={v.id} />
                        <SubmitButton className="btn btn-sm" pendingLabel="Working...">
                          Reject
                        </SubmitButton>
                      </form>
                    </>
                  )}
                  <form action={setPublished}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="publish" value={v.isPublished ? "false" : "true"} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SubmitButton className="btn btn-sm" pendingLabel="Working...">
                      {v.isPublished ? "Unpublish" : "Publish"}
                    </SubmitButton>
                  </form>
                  <ConfirmAction
                    triggerLabel="Delete"
                    title={`Delete ${v.fullName}?`}
                    description="This permanently removes the profile and its photo. To hide a profile without deleting it, unpublish it instead."
                    confirmLabel="Delete volunteer"
                    action={deleteVolunteer}
                    fields={{ id: v.id }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
          {page > 1 ? (
            <Link href={listHref({ q, team, status, page: page - 1 })} className="btn">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-mist">
            Page {page} of {result.pageCount}
          </p>
          {page < result.pageCount ? (
            <Link href={listHref({ q, team, status, page: page + 1 })} className="btn">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
