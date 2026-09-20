/**
 * Returns a normalised https URL, or null when the value is not safe to render as a link.
 * Used at render time as a second line of defence: the database also enforces https-only URLs.
 */
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Short human label such as "github.com/ada" for showing under a button. */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/$/, "");
    const label = `${host}${path}`;
    return label.length > 42 ? `${label.slice(0, 41)}…` : label;
  } catch {
    return url;
  }
}
