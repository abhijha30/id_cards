import { safeAdminRedirect } from "@/lib/validation/auth";

/** Fixed message catalogue. Pages only ever render text from here, never raw query-string text. */
export const NOTICES = {
  created: "Volunteer created. Add a photo below, then publish when consent is recorded.",
  saved: "Changes saved.",
  deleted: "Volunteer deleted.",
  published: "Profile published. It is now visible in the public directory.",
  unpublished: "Profile unpublished. It is no longer visible to the public.",
  "team-saved": "Team saved.",
  "team-deleted": "Team deleted.",
  "team-updated": "Team updated.",
} as const;

export const ERRORS = {
  "consent-required": "Record consent as granted before publishing a profile.",
  "team-has-volunteers": "This team still has volunteers. Move them to another team first, or deactivate the team instead.",
  "not-found": "That record no longer exists.",
  failed: "Something went wrong and nothing was changed. Try again.",
} as const;

export type NoticeCode = keyof typeof NOTICES;
export type ErrorCode = keyof typeof ERRORS;

export function noticeText(code: string | string[] | undefined): string | null {
  const key = Array.isArray(code) ? code[0] : code;
  return key && key in NOTICES ? NOTICES[key as NoticeCode] : null;
}

export function errorText(code: string | string[] | undefined): string | null {
  const key = Array.isArray(code) ? code[0] : code;
  return key && key in ERRORS ? ERRORS[key as ErrorCode] : null;
}

/** Builds an /admin URL carrying a notice or error code. `returnTo` must stay inside /admin. */
export function adminUrlWith(returnTo: string, params: { notice?: NoticeCode; error?: ErrorCode }): string {
  const safe = safeAdminRedirect(returnTo);
  const url = new URL(safe, "http://admin.local");
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  if (params.notice) url.searchParams.set("notice", params.notice);
  if (params.error) url.searchParams.set("error", params.error);
  return `${url.pathname}${url.search}`;
}
