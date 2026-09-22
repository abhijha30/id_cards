import "server-only";

export const INVITE_TOKEN_BYTES = 32;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type InviteType = "upload" | "update";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex digest. The raw token is never stored — only this. */
export async function hashInviteToken(rawToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  return toHex(digest);
}

/** Generates a new random raw token (shown to the admin once) and its stored hash. */
export async function generateInviteToken(): Promise<{ rawToken: string; tokenHash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_TOKEN_BYTES));
  const rawToken = toBase64Url(bytes);
  return { rawToken, tokenHash: await hashInviteToken(rawToken) };
}

export function inviteExpiryFromNow(): string {
  return new Date(Date.now() + INVITE_TTL_MS).toISOString();
}

/** Builds the private URL shown to the admin. */
export function inviteUrl(type: InviteType, rawToken: string, siteUrl: string): string {
  const path = type === "upload" ? "team-upload" : "team-update";
  return `${siteUrl.replace(/\/$/, "")}/${path}/${rawToken}`;
}

/** Format check before hitting the database — same defence-in-depth style as isUuid()/isValidSlug(). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,80}$/;
export function isPlausibleToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}
