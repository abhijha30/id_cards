import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicShell } from "@/components/ui/PublicShell";
import { DirectorySearch } from "@/components/directory/DirectorySearch";
import { TeamFilter } from "@/components/directory/TeamFilter";
import { VolunteerCard } from "@/components/directory/VolunteerCard";
import { Pagination } from "@/components/directory/Pagination";
import { ResultsSkeleton } from "@/components/directory/ResultsSkeleton";

import {
  directoryHref,
  parseDirectoryParams,
  type DirectoryParams,
  type SearchParamValue,
} from "@/lib/directory-params";

import {
  listPublicTeams,
  listPublicVolunteers,
  type PublicTeam,
} from "@/lib/data/public";

type Props = {
  searchParams: Promise<{
    q?: SearchParamValue;
    team?: SearchParamValue;
    page?: SearchParamValue;
  }>;
};

export default async function DirectoryPage({ searchParams }: Props) {
  const rawSearchParams = await searchParams;
  const params = parseDirectoryParams(rawSearchParams);

  return (
    <PublicShell>
      <section className="max-w-3xl">
        <h1 className="text-4xl font-bold sm:text-6xl">
          Find a GDG Noida volunteer
        </h1>

        <p className="mt-5 text-lg text-mist">
          Scanned a volunteer&rsquo;s ID card? Search the name printed on it to
          confirm who you are speaking with.
        </p>
      </section>

      <div className="mt-8 max-w-3xl">
        <DirectorySearch
          initialQuery={params.q}
          team={params.team}
        />
      </div>

      <div className="mt-6">
        <Suspense
          fallback={
            <div
              className="skeleton h-10 w-full max-w-xl rounded-full"
              aria-hidden="true"
            />
          }
        >
          <Teams
            q={params.q}
            active={params.team}
          />
        </Suspense>
      </div>

      <div className="mt-10">
        <Suspense
          key={`${params.q}|${params.team}|${params.page}`}
          fallback={<ResultsSkeleton />}
        >
          <Results params={params} />
        </Suspense>
      </div>
    </PublicShell>
  );
}

async function Teams({
  q,
  active,
}: {
  q: string;
  active: string | null;
}) {
  let teams: PublicTeam[];

  try {
    teams = await listPublicTeams();
  } catch (error) {
    // Team filters are optional. The directory should still work
    // if the teams query fails.
    console.error("Could not load teams", error);
    return null;
  }

  return (
    <TeamFilter
      teams={teams}
      q={q}
      active={active}
    />
  );
}

async function Results({
  params,
}: {
  params: DirectoryParams;
}) {
  let result;

  try {
    result = await listPublicVolunteers(params);
  } catch (error) {
    console.error("Could not load the directory", error);

    return (
      <div
        role="alert"
        className="panel max-w-xl p-6"
      >
        <h2 className="text-xl font-semibold">
          The directory could not be loaded
        </h2>

        <p className="mt-2 text-mist">
          Something went wrong on our side. Please try again in a moment.
        </p>

        <Link
          href={directoryHref({
            q: params.q,
            team: params.team,
          })}
          className="btn mt-4"
        >
          Try again
        </Link>
      </div>
    );
  }

  /*
   * If someone opens an old bookmark pointing to a page
   * that no longer exists, redirect them to the last valid page.
   */
  if (
    result.volunteers.length === 0 &&
    result.total > 0 &&
    params.page > result.pageCount
  ) {
    redirect(
      directoryHref({
        q: params.q,
        team: params.team,
        page: result.pageCount,
      }),
    );
  }

  const filtered =
    params.q !== "" ||
    params.team !== null;

  /*
   * No results at all.
   */
  if (result.total === 0) {
    return (
      <div className="panel max-w-xl p-6">
        <h2 className="text-xl font-semibold">
          {filtered
            ? "No volunteers match that search"
            : "No volunteers are listed yet"}
        </h2>

        <p className="mt-2 text-mist">
          {filtered
            ? "Check the spelling, try fewer letters, or remove the team filter. A volunteer who has not agreed to be listed will not appear here."
            : "Profiles appear here once volunteers have agreed to be listed."}
        </p>

        {filtered ? (
          <Link
            href="/"
            className="btn mt-4"
          >
            Clear search and filters
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="results-heading">
      <h2
        id="results-heading"
        className="mb-6 text-base font-normal text-mist"
        aria-live="polite"
      >
        {result.total}{" "}
        {result.total === 1 ? "volunteer" : "volunteers"}

        {params.q ? (
          <>
            {" "}
            matching &ldquo;{params.q}&rdquo;
          </>
        ) : null}
      </h2>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {result.volunteers.map((volunteer, index) => (
          <VolunteerCard
            key={volunteer.id}
            volunteer={volunteer}
            priority={index < 4}
          />
        ))}
      </ul>

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        q={params.q}
        team={params.team}
      />
    </section>
  );
}
