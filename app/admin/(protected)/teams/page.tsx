import { Notice } from "@/components/admin/Notice";
import { TeamForm } from "@/components/admin/TeamForm";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { requireAdmin } from "@/lib/auth/admin";
import { listAdminTeams } from "@/lib/data/admin";
import { accentVar, teamAccent } from "@/lib/utils/team-accent";
import { deleteTeam, saveTeam } from "./actions";

export const metadata = { title: "Teams" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TeamsPage({ searchParams }: Props) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const teams = await listAdminTeams(supabase);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold sm:text-4xl">Teams</h1>
      <p className="mb-8 mt-2 text-mist">Teams appear as filters on the public directory. Rename, add or hide them here.</p>

      <Notice notice={sp.notice} error={sp.error} />

      <section aria-labelledby="add-team" className="panel mb-10 p-6">
        <h2 id="add-team" className="mb-4 text-xl font-semibold">
          Add a team
        </h2>
        <TeamForm action={saveTeam} />
      </section>

      {teams.length === 0 ? (
        <p className="panel p-6 text-mist">No teams yet. Add one above, or run supabase/seed.sql for example teams.</p>
      ) : (
        <ul className="space-y-3">
          {teams.map((team) => (
            <li key={team.id} className="panel p-5">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 rounded-lg">
                  <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: accentVar(teamAccent(team.slug)) }} />
                  <span className="text-lg font-semibold">{team.name}</span>
                  <span className="text-sm text-mist">
                    {team.volunteerCount} {team.volunteerCount === 1 ? "volunteer" : "volunteers"}
                  </span>
                  {!team.isActive && <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs text-mist">Inactive</span>}
                  <span className="ml-auto text-sm text-mist underline underline-offset-4">Edit</span>
                </summary>
                <div className="mt-5 space-y-6 border-t border-line pt-5">
                  <TeamForm action={saveTeam} team={team} />
                  <div>
                    <ConfirmAction
                      triggerLabel="Delete team"
                      title={`Delete ${team.name}?`}
                      description={
                        team.volunteerCount > 0
                          ? "This team still has volunteers, so it cannot be deleted. Move them first, or mark the team inactive instead."
                          : "The team will be removed permanently."
                      }
                      confirmLabel="Delete team"
                      action={deleteTeam}
                      fields={{ id: team.id }}
                    />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
