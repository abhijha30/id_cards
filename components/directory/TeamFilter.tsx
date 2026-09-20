import Link from "next/link";
import { directoryHref } from "@/lib/directory-params";
import type { PublicTeam } from "@/lib/data/public";
import { accentVar, teamAccent } from "@/lib/utils/team-accent";

type Props = { teams: PublicTeam[]; q: string; active: string | null };

export function TeamFilter({ teams, q, active }: Props) {
  if (teams.length === 0) return null;

  const base = "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors";
  const idle = "border-line-strong text-mist hover:border-mist hover:text-fog";
  const on = "border-fog bg-fog text-ink font-semibold";

  return (
    <nav aria-label="Filter by team">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href={directoryHref({ q })} aria-current={active === null ? "true" : undefined} className={`${base} ${active === null ? on : idle}`}>
            All teams
          </Link>
        </li>
        {teams.map((team) => {
          const isActive = active === team.slug;
          return (
            <li key={team.id}>
              <Link
                href={directoryHref({ q, team: team.slug })}
                aria-current={isActive ? "true" : undefined}
                className={`${base} ${isActive ? on : idle}`}
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: accentVar(teamAccent(team.slug)) }} />
                {team.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
