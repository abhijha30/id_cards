import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

export const TEAM_LINK_TYPES = ["upload", "update"] as const;

export type TeamLinkType = (typeof TEAM_LINK_TYPES)[number];

export const TEAM_LINK_STATUSES = [
  "active",
  "used",
  "revoked",
  "expired",
] as const;

export type TeamLinkStatus = (typeof TEAM_LINK_STATUSES)[number];

export const TEAM_LINK_EXPIRY_HOURS = 24;

/**
 * Generate a cryptographically secure random token.
 *
 * 32 random bytes = 256 bits of entropy.
 *
 * The token is safe to put in a URL.
 */
function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash the raw token before storing it in the database.
 *
 * The raw token is only returned to the caller once.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Calculate the default expiration time.
 */
function getExpirationDate(): Date {
  return new Date(Date.now() + TEAM_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
}

export type CreateTeamLinkInput = {
  type: TeamLinkType;
  profileId?: string | null;
};

export type CreatedTeamLink = {
  id: string;
  token: string;
  tokenHash: string;
  type: TeamLinkType;
  profileId: string | null;
  expiresAt: string;
};

/**
 * Create a secure one-time team link.
 *
 * The raw token is never stored in Supabase.
 * Only its SHA-256 hash is stored.
 */
export async function createTeamLink(
  input: CreateTeamLinkInput,
  supabase: SupabaseClient = createServiceClient(),
): Promise<CreatedTeamLink> {
  const token = generateRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = getExpirationDate();

  const profileId = input.profileId ?? null;

  if (input.type === "update" && !profileId) {
    throw new Error("An update link requires a profile ID.");
  }

  const { data, error } = await supabase
    .from("team_invites")
    .insert({
      token_hash: tokenHash,
      profile_id: profileId,
      type: input.type,
      expires_at: expiresAt.toISOString(),
      status: "active",
    })
    .select("id, token_hash, profile_id, type, expires_at")
    .single();

  if (error) {
    console.error("createTeamLink failed", error);
    throw new Error("Could not create the team link.");
  }

  return {
    id: data.id,
    token,
    tokenHash: data.token_hash,
    type: data.type as TeamLinkType,
    profileId: data.profile_id,
    expiresAt: data.expires_at,
  };
}

export type TeamLinkRecord = {
  id: string;
  profileId: string | null;
  type: TeamLinkType;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: TeamLinkStatus;
};

/**
 * Convert the database record into the application's camelCase structure.
 */
function mapTeamLink(row: {
  id: string;
  profile_id: string | null;
  type: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  status: string;
}): TeamLinkRecord {
  if (!TEAM_LINK_TYPES.includes(row.type as TeamLinkType)) {
    throw new Error("Invalid team link type.");
  }

  if (!TEAM_LINK_STATUSES.includes(row.status as TeamLinkStatus)) {
    throw new Error("Invalid team link status.");
  }

  return {
    id: row.id,
    profileId: row.profile_id,
    type: row.type as TeamLinkType,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    status: row.status as TeamLinkStatus,
  };
}

/**
 * Mark an expired link as expired.
 *
 * This is intentionally done server-side.
 */
async function markExpired(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("team_invites")
    .update({
      status: "expired",
    })
    .eq("id", id)
    .eq("status", "active");

  if (error) {
    console.error("markExpired failed", error);
  }
}

/**
 * Look up a team link by the raw token.
 *
 * The database only contains the token hash.
 *
 * This function does NOT consume the token.
 */
export async function getTeamLink(
  token: string,
  supabase: SupabaseClient = createServiceClient(),
): Promise<TeamLinkRecord | null> {
  const normalizedToken = token.trim();

  if (!/^[a-f0-9]{64}$/i.test(normalizedToken)) {
    return null;
  }

  const tokenHash = hashToken(normalizedToken);

  const { data, error } = await supabase
    .from("team_invites")
    .select(
      "id, profile_id, type, expires_at, used_at, revoked_at, created_at, status",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("getTeamLink failed", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const link = mapTeamLink(data);

  if (link.status !== "active") {
    return link;
  }

  const expired = new Date(link.expiresAt).getTime() <= Date.now();

  if (expired) {
    await markExpired(supabase, link.id);

    return {
      ...link,
      status: "expired",
    };
  }

  return link;
}

/**
 * Verify that a token can currently be used.
 *
 * This is useful before rendering an upload/update form.
 */
export async function validateTeamLink(
  token: string,
  expectedType: TeamLinkType,
  supabase: SupabaseClient = createServiceClient(),
): Promise<TeamLinkRecord | null> {
  const link = await getTeamLink(token, supabase);

  if (!link) return null;

  if (link.type !== expectedType) {
    return null;
  }

  if (link.status !== "active") {
    return null;
  }

  if (new Date(link.expiresAt).getTime() <= Date.now()) {
    await markExpired(supabase, link.id);
    return null;
  }

  return link;
}

/**
 * Atomically consume a team link.
 *
 * The update only succeeds when the token is still active and has not expired.
 *
 * This protects against accidentally using the same link twice, including
 * two requests arriving very close together.
 */
export async function consumeTeamLink(
  token: string,
  expectedType: TeamLinkType,
  supabase: SupabaseClient = createServiceClient(),
): Promise<TeamLinkRecord | null> {
  const normalizedToken = token.trim();

  if (!/^[a-f0-9]{64}$/i.test(normalizedToken)) {
    return null;
  }

  const tokenHash = hashToken(normalizedToken);

  const now = new Date();
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from("team_invites")
    .update({
      status: "used",
      used_at: nowIso,
    })
    .eq("token_hash", tokenHash)
    .eq("type", expectedType)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .select(
      "id, profile_id, type, expires_at, used_at, revoked_at, created_at, status",
    )
    .maybeSingle();

  if (error) {
    console.error("consumeTeamLink failed", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return mapTeamLink(data);
}

/**
 * Revoke a team link.
 *
 * Revoked links can never be consumed again.
 */
export async function revokeTeamLink(
  id: string,
  supabase: SupabaseClient = createServiceClient(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("team_invites")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("revokeTeamLink failed", error);
    return false;
  }

  return Boolean(data);
}

/**
 * Build the public URL that an administrator can send to a team member.
 *
 * NEXT_PUBLIC_SITE_URL is used because this is the canonical public
 * application URL already used by the project.
 */
export function buildTeamLinkUrl(
  type: TeamLinkType,
  token: string,
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
  }

  const base = siteUrl.replace(/\/+$/, "");

  return `${base}/team-${type}/${encodeURIComponent(token)}`;
}
