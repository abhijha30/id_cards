import { z } from "zod";
import { DIRECTORY_PAGE_SIZE } from "@/lib/config";
import { createPublicClient } from "@/lib/supabase/public";
import { SOCIAL_KEYS, type PublicSocialLinks } from "@/lib/social";
import { escapeLikePattern, searchTokens } from "@/lib/utils/search";
import { isValidSlug } from "@/lib/utils/slug";
import { safeExternalUrl } from "@/lib/utils/safe-url";

/**
 * Public read model. Everything here runs as the `anon` role against the restricted
 * `public_volunteers` view and the active-teams policy: only published, consented profiles.
 */

export class DirectoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DirectoryError";
  }
}

const rowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  full_name: z.string(),
  public_role: z.string().nullable(),
  bio: z.string().nullable(),
  photo_path: z.string().nullable(),
  skills: z.array(z.string()).nullable(),
  social_links: z.record(z.string(), z.unknown()).nullable(),
  published_at: z.string().nullable(),
  updated_at: z.string(),
  team_id: z.string().nullable(),
  team_name: z.string().nullable(),
  team_slug: z.string().nullable(),
});

export type PublicVolunteer = {
  id: string;
  slug: string;
  fullName: string;
  publicRole: string | null;
  bio: string | null;
  hasPhoto: boolean;
  skills: string[];
  socialLinks: PublicSocialLinks;
  updatedAt: string;
  team: { id: string; name: string; slug: string } | null;
};

const COLUMNS =
  "id, slug, full_name, public_role, bio, photo_path, skills, social_links, published_at, updated_at, team_id, team_name, team_slug";

function toPublicVolunteer(input: unknown): PublicVolunteer {
  const row = rowSchema.parse(input);

  // Defence in depth: only known platforms, only safe https URLs.
  const socialLinks: PublicSocialLinks = {};
  for (const key of SOCIAL_KEYS) {
    const safe = safeExternalUrl(row.social_links?.[key]);
    if (safe) socialLinks[key] = safe;
  }

  return {
    id: row.id,
    slug: row.slug,
    fullName: row.full_name,
    publicRole: row.public_role,
    bio: row.bio,
    hasPhoto: row.photo_path !== null,
    skills: row.skills ?? [],
    socialLinks,
    updatedAt: row.updated_at,
    team: row.team_id && row.team_name && row.team_slug ? { id: row.team_id, name: row.team_name, slug: row.team_slug } : null,
  };
}

export type DirectoryQuery = { q: string; team: string | null; page: number };

export type DirectoryPage = {
  volunteers: PublicVolunteer[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

/** Server-side search, team filter and pagination. Never loads more than one page of rows. */
export async function listPublicVolunteers(query: DirectoryQuery): Promise<DirectoryPage> {
  const supabase = createPublicClient();
  const pageSize = DIRECTORY_PAGE_SIZE;
  const from = (query.page - 1) * pageSize;
  const to = from + pageSize - 1;

  let request = supabase
    .from("public_volunteers")
    .select(COLUMNS, { count: "exact" })
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  for (const token of searchTokens(query.q)) {
    request = request.ilike("full_name", `%${escapeLikePattern(token)}%`);
  }
  if (query.team) request = request.eq("team_slug", query.team);

  const { data, error, count } = await request;

  if (error) {
    // PGRST103: the requested page is beyond the last row. Report the real total instead.
    if (error.code === "PGRST103") {
      const total = await countPublicVolunteers(query);
      return { volunteers: [], total, page: query.page, pageCount: Math.max(1, Math.ceil(total / pageSize)), pageSize };
    }
    throw new DirectoryError("Could not load volunteers.", { cause: error });
  }

  const total = count ?? data.length;
  return {
    volunteers: data.map(toPublicVolunteer),
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
  };
}

async function countPublicVolunteers(query: DirectoryQuery): Promise<number> {
  const supabase = createPublicClient();
  let request = supabase.from("public_volunteers").select("id", { count: "exact", head: true });
  for (const token of searchTokens(query.q)) {
    request = request.ilike("full_name", `%${escapeLikePattern(token)}%`);
  }
  if (query.team) request = request.eq("team_slug", query.team);
  const { count, error } = await request;
  if (error) throw new DirectoryError("Could not count volunteers.", { cause: error });
  return count ?? 0;
}

export async function getPublicVolunteerBySlug(slug: string): Promise<PublicVolunteer | null> {
  if (!isValidSlug(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("public_volunteers").select(COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new DirectoryError("Could not load the volunteer profile.", { cause: error });
  return data ? toPublicVolunteer(data) : null;
}

/** Storage path for a published volunteer's photo (used by the /photos/[slug] route). */
export async function getPublicPhotoPath(slug: string): Promise<string | null> {
  if (!isValidSlug(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("public_volunteers").select("photo_path").eq("slug", slug).maybeSingle();
  if (error) throw new DirectoryError("Could not look up the photo.", { cause: error });
  const path = (data as { photo_path?: string | null } | null)?.photo_path;
  return path ?? null;
}

export type PublicTeam = { id: string; name: string; slug: string };

export async function listPublicTeams(): Promise<PublicTeam[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("teams").select("id, name, slug").order("name", { ascending: true });
  if (error) throw new DirectoryError("Could not load teams.", { cause: error });
  return z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })).parse(data);
}
