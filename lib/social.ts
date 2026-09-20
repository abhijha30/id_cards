/** The social platforms a volunteer can list. Keys match the database CHECK constraint. */
export const SOCIAL_PLATFORMS = [
  { key: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"], placeholder: "https://www.linkedin.com/in/username" },
  { key: "instagram", label: "Instagram", hosts: ["instagram.com"], placeholder: "https://www.instagram.com/username" },
  { key: "github", label: "GitHub", hosts: ["github.com"], placeholder: "https://github.com/username" },
  { key: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], placeholder: "https://www.youtube.com/@channel" },
  { key: "x", label: "X", hosts: ["x.com", "twitter.com"], placeholder: "https://x.com/username" },
  { key: "website", label: "Personal website", hosts: null, placeholder: "https://example.com" },
] as const;

export type SocialKey = (typeof SOCIAL_PLATFORMS)[number]["key"];

export const SOCIAL_KEYS: SocialKey[] = SOCIAL_PLATFORMS.map((p) => p.key);

/** Admin-side shape stored in volunteers.social_links */
export type SocialLinkEntry = { url: string; approved: boolean };
export type SocialLinks = Partial<Record<SocialKey, SocialLinkEntry>>;

/** Public shape (approved links only) exposed by the public view */
export type PublicSocialLinks = Partial<Record<SocialKey, string>>;

export function platformByKey(key: string) {
  return SOCIAL_PLATFORMS.find((p) => p.key === key);
}

function hostMatches(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowed.some((h) => host === h || host.endsWith(`.${h}`));
}

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.localhost|.*\.internal)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type NormalizeResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validates and normalises a social URL for one platform.
 * - https only (a missing scheme is assumed to be https)
 * - no embedded credentials
 * - host must belong to the platform (any public host for "website")
 * - no localhost / IP addresses
 */
export function normalizeSocialUrl(key: SocialKey, raw: string): NormalizeResult {
  const platform = platformByKey(key);
  if (!platform) return { ok: false, error: "Unknown platform." };

  let value = raw.trim();
  if (!value) return { ok: false, error: "Enter a link." };
  if (/\s/.test(value)) return { ok: false, error: "The link must not contain spaces." };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "This does not look like a valid link." };
  }

  if (url.protocol !== "https:") return { ok: false, error: "Only https:// links are allowed." };
  if (url.username || url.password) return { ok: false, error: "Links must not contain a username or password." };

  const host = url.hostname;
  if (!host.includes(".") || PRIVATE_HOST.test(host) || IPV4.test(host) || host.startsWith("[")) {
    return { ok: false, error: "Use a public web address, not localhost or an IP address." };
  }
  if (platform.hosts && !hostMatches(host, platform.hosts)) {
    return { ok: false, error: `This does not look like a ${platform.label} link (expected ${platform.hosts.join(" or ")}).` };
  }

  const normalised = url.toString();
  if (normalised.length > 300) return { ok: false, error: "The link is too long (300 characters maximum)." };
  return { ok: true, url: normalised };
}
