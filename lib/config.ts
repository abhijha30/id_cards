/**
 * App-wide constants. Anything an organiser may want to change lives here.
 */

export const ORG_NAME = "GDG Noida";
export const APP_NAME = "GDG Noida Volunteer Directory";

/**
 * Approved logo asset. Leave null to show the neutral placeholder mark.
 * To use the real logo: put the approved file in /public/brand/ (for example
 * /public/brand/gdg-noida-logo.svg) and set this to "/brand/gdg-noida-logo.svg".
 * Do not draw or approximate the official GDG logo: use the asset from the organisers.
 */
export const BRAND_LOGO_SRC: string | null = "/gdg-noida-logo.png";
/** Volunteers per page on the public directory and in the admin list. */
export const DIRECTORY_PAGE_SIZE = 24;
export const ADMIN_PAGE_SIZE = 25;

/**
 * Should search engines index the directory and profiles?
 * Default is false: volunteers are private individuals who consented to being listed for
 * people who scan an ID card, not necessarily to appearing in web search results.
 * The organisation should decide this deliberately (see docs/PRIVACY-CHECKLIST.md).
 */
export const SEARCH_ENGINE_INDEXING = false;

/**
 * Version label stored with every recorded consent. Bump it whenever the wording of the
 * privacy page or the consent form changes materially, so records show what was agreed to.
 */
export const CONSENT_VERSION = "2026-09-draft-1";

/** Private storage bucket created by supabase/migrations/*_storage.sql */
export const PHOTO_BUCKET = "volunteer-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Address shown on the privacy page for removal / correction requests (optional). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
