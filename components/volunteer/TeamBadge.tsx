import { accentVar, teamAccent } from "@/lib/utils/team-accent";

export function TeamBadge({ name, slug }: { name: string; slug: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-sm text-mist">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: accentVar(teamAccent(slug)) }} />
      {name}
    </span>
  );
}
