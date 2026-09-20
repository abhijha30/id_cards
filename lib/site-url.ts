/**
 * The canonical public URL of the directory. This exact string is what the master QR code
 * encodes, so it is validated strictly and never silently rewritten.
 */
export type SiteUrlStatus = {
  /** The configured value, trimmed. Null when missing or invalid. */
  url: string | null;
  /** True when the URL is usable at all (the QR page allows downloads). */
  configured: boolean;
  /** Blocking problem, when `configured` is false. */
  error: string | null;
  /** Non-blocking problems the admin should read before printing ID cards. */
  warnings: string[];
};

const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|.*\.local|.*\.localhost)$/i;

export function evaluateSiteUrl(raw: string | undefined | null): SiteUrlStatus {
  const value = (raw ?? "").trim();
  if (!value) {
    return {
      url: null,
      configured: false,
      error: "NEXT_PUBLIC_SITE_URL is not set. Set it to the final public address of the directory.",
      warnings: [],
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      url: null,
      configured: false,
      error: "NEXT_PUBLIC_SITE_URL is not a valid absolute URL (example: https://your-domain).",
      warnings: [],
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      url: null,
      configured: false,
      error: "NEXT_PUBLIC_SITE_URL must start with https:// (or http:// for local testing).",
      warnings: [],
    };
  }
  if (parsed.username || parsed.password) {
    return {
      url: null,
      configured: false,
      error: "NEXT_PUBLIC_SITE_URL must not contain a username or password.",
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (LOCAL_HOST.test(parsed.hostname)) {
    warnings.push(
      "This address only works on your own computer or network. A QR code that points here will not work for anyone else. Set the real production URL before printing ID cards.",
    );
  } else if (parsed.protocol === "http:") {
    warnings.push("This address uses http://. Use https:// so visitors' browsers do not show security warnings.");
  }
  if (parsed.search || parsed.hash) {
    warnings.push("The URL contains a query string or fragment. The QR code should point to the plain directory address.");
  }

  return { url: value, configured: true, error: null, warnings };
}

export function getSiteUrlStatus(): SiteUrlStatus {
  // Referenced literally so Next.js inlines it at build time.
  return evaluateSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

/** Base URL for metadata. Falls back to localhost so `next build` works before configuration. */
export function getMetadataBase(): URL {
  const { url } = getSiteUrlStatus();
  try {
    return new URL(url ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
