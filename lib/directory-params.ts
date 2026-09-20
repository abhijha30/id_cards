import { normalizeSearchText } from "@/lib/utils/search";
import { isValidSlug } from "@/lib/utils/slug";

export type SearchParamValue = string | string[] | undefined;

function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type DirectoryParams = { q: string; team: string | null; page: number };

/** Turns untrusted URL parameters into a safe query. */
export function parseDirectoryParams(raw: {
  q?: SearchParamValue;
  team?: SearchParamValue;
  page?: SearchParamValue;
}): DirectoryParams {
  const q = normalizeSearchText(first(raw.q));
  const teamRaw = first(raw.team)?.trim() ?? "";
  const team = teamRaw && isValidSlug(teamRaw, 60) ? teamRaw : null;
  const pageNumber = Number.parseInt(first(raw.page) ?? "1", 10);
  const page = Number.isFinite(pageNumber) ? Math.min(Math.max(pageNumber, 1), 1000) : 1;
  return { q, team, page };
}

/** Builds a directory URL, omitting empty parameters. */
export function directoryHref(params: { q?: string; team?: string | null; page?: number }): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.team) search.set("team", params.team);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/?${query}` : "/";
}
