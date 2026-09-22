import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ADMIN_PAGE_SIZE, PHOTO_BUCKET } from "@/lib/config";
import { SOCIAL_KEYS, type SocialLinks } from "@/lib/social";
import {
  CONSENT_STATUSES,
  type ConsentStatus,
} from "@/lib/validation/volunteer";
import { escapeLikePattern, searchTokens } from "@/lib/utils/search";
import { safeExternalUrl } from "@/lib/utils/safe-url";
import { isUuid } from "@/lib/validation/common";

/** Admin-side reads. Callers pass the session client from requireAdmin(), so RLS applies. */

export class AdminDataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AdminDataError";
  }
}

const teamRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const volunteerRowSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  slug: z.string(),
  team_id: z.string().nullable(),
  public_role: z.string().nullable(),
  bio: z.string().nullable(),
  photo_path: z.string().nullable(),
  skills: z.array(z.string()).nullable(),
  social_links: z.record(z.string(), z.unknown()).nullable(),
  is_published: z.boolean(),
  consent_status: z.enum(CONSENT_STATUSES),
  consent_recorded_at: z.string().nullable(),
  consent_version: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  published_at: z.string().nullable(),

  // Team submission review status
  submission_status: z.enum([
    "pending",
    "approved",
    "rejected",
    "update-pending",
  ]),

  // Changes submitted through a team update link,
  // waiting for admin approval.
  pending_changes: z.record(z.string(), z.unknown()).nullable(),

  team: teamRefSchema.nullable(),
});

export type AdminVolunteer = {
  id: string;
  fullName: string;
  slug: string;
  teamId: string | null;
  team: {
    id: string;
    name: string;
    slug: string;
  } | null;
  publicRole: string | null;
  bio: string | null;
  photoPath: string | null;
  skills: string[];
  socialLinks: SocialLinks;
  isPublished: boolean;
  consentStatus: ConsentStatus;
  consentRecordedAt: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;

  // Team submission review status
  submissionStatus:
    | "pending"
    | "approved"
    | "rejected"
    | "update-pending";

  // Pending changes from a team update
  pendingChanges: Record<string, unknown> | null;
};

const ADMIN_COLUMNS =
  "id, full_name, slug, team_id, public_role, bio, photo_path, skills, social_links, is_published, consent_status, consent_recorded_at, consent_version, created_at, updated_at, published_at, submission_status, pending_changes, team:teams(id, name, slug)";

function toAdminVolunteer(input: unknown): AdminVolunteer {
  const row = volunteerRowSchema.parse(input);

  const socialLinks: SocialLinks = {};

  for (const key of SOCIAL_KEYS) {
    const entry = row.social_links?.[key];

    if (entry && typeof entry === "object") {
      const { url, approved } = entry as {
        url?: unknown;
        approved?: unknown;
      };

      const safe = safeExternalUrl(url);

      if (safe) {
        socialLinks[key] = {
          url: safe,
          approved: approved === true,
        };
      }
    }
  }

  return {
    id: row.id,
    fullName: row.full_name,
    slug: row.slug,
    teamId: row.team_id,
    team: row.team,
    publicRole: row.public_role,
    bio: row.bio,
    photoPath: row.photo_path,
    skills: row.skills ?? [],
    socialLinks,
    isPublished: row.is_published,
    consentStatus: row.consent_status,
    consentRecordedAt: row.consent_recorded_at,
    consentVersion: row.consent_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,

    submissionStatus: row.submission_status,
    pendingChanges: row.pending_changes,
  };
}

export const STATUS_FILTERS = [
  "all",
  "published",
  "draft",
  "consent-missing",
  "pending-review",
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];

export async function listAdminVolunteers(
  supabase: SupabaseClient,
  query: AdminVolunteerQuery,
) {
  const from = (query.page - 1) * ADMIN_PAGE_SIZE;
  const to = from + ADMIN_PAGE_SIZE - 1;

  let request = supabase
    .from("volunteers")
    .select(ADMIN_COLUMNS, { count: "exact" })
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  for (const token of searchTokens(query.q)) {
    request = request.ilike(
      "full_name",
      `%${escapeLikePattern(token)}%`,
    );
  }

  if (query.team === "none") {
    request = request.is("team_id", null);
  } else if (query.team && isUuid(query.team)) {
    request = request.eq("team_id", query.team);
  }

  if (query.status === "published") {
    request = request.eq("is_published", true);
  } else if (query.status === "draft") {
    request = request.eq("is_published", false);
  } else if (query.status === "consent-missing") {
    request = request.neq("consent_status", "granted");
  } else if (query.status === "pending-review") {
    request = request.in("submission_status", [
      "pending",
      "update-pending",
    ]);
  }

  const { data, error, count } = await request;

  if (error) {
    if (error.code === "PGRST103") {
      return {
        volunteers: [] as AdminVolunteer[],
        total: count ?? 0,
        pageCount: 1,
      };
    }

    throw new AdminDataError("Could not load volunteers.", {
      cause: error,
    });
  }

  const total = count ?? data.length;

  return {
    volunteers: data.map(toAdminVolunteer),
    total,
    pageCount: Math.max(
      1,
      Math.ceil(total / ADMIN_PAGE_SIZE),
    ),
  };
}

export async function getAdminVolunteer(
  supabase: SupabaseClient,
  id: string,
): Promise<AdminVolunteer | null> {
  if (!isUuid(id)) return null;

  const { data, error } = await supabase
    .from("volunteers")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new AdminDataError(
      "Could not load the volunteer.",
      { cause: error },
    );
  }

  return data ? toAdminVolunteer(data) : null;
}

const teamRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  updated_at: z.string(),
  volunteers: z.array(
    z.object({
      count: z.number(),
    }),
  ),
});

export type AdminTeam = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  volunteerCount: number;
};

export async function listAdminTeams(
  supabase: SupabaseClient,
): Promise<AdminTeam[]> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, slug, description, is_active, updated_at, volunteers(count)",
    )
    .order("name", { ascending: true });

  if (error) {
    throw new AdminDataError("Could not load teams.", {
      cause: error,
    });
  }

  return z
    .array(teamRowSchema)
    .parse(data)
    .map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      isActive: t.is_active,
      volunteerCount: t.volunteers[0]?.count ?? 0,
    }));
}

export async function listTeamOptions(
  supabase: SupabaseClient,
) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  if (error) {
    throw new AdminDataError("Could not load teams.", {
      cause: error,
    });
  }

  return z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        is_active: z.boolean(),
      }),
    )
    .parse(data)
    .map((t) => ({
      id: t.id,
      name: t.name,
      isActive: t.is_active,
    }));
}

export type DashboardCounts = {
  total: number;
  published: number;
  draft: number;
  consentMissing: number;
  teams: number;
};

export async function getDashboardCounts(
  supabase: SupabaseClient,
): Promise<DashboardCounts> {
  const head = {
    count: "exact" as const,
    head: true,
  };

  const [
    total,
    published,
    consentMissing,
    teams,
  ] = await Promise.all([
    supabase
      .from("volunteers")
      .select("id", head),

    supabase
      .from("volunteers")
      .select("id", head)
      .eq("is_published", true),

    supabase
      .from("volunteers")
      .select("id", head)
      .neq("consent_status", "granted"),

    supabase
      .from("teams")
      .select("id", head),
  ]);

  const failed = [
    total,
    published,
    consentMissing,
    teams,
  ].find((r) => r.error);

  if (failed?.error) {
    throw new AdminDataError(
      "Could not load dashboard counts.",
      {
        cause: failed.error,
      },
    );
  }

  const t = total.count ?? 0;
  const p = published.count ?? 0;

  return {
    total: t,
    published: p,
    draft: t - p,
    consentMissing: consentMissing.count ?? 0,
    teams: teams.count ?? 0,
  };
}

/** Signed URLs (1 hour) so admins can preview photos of unpublished volunteers. */

export async function signPhotoUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths)];

  if (unique.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, 60 * 60);

  if (error || !data) return {};

  const out: Record<string, string> = {};

  for (const item of data) {
    if (item.path && item.signedUrl) {
      out[item.path] = item.signedUrl;
    }
  }

  return out;
}
