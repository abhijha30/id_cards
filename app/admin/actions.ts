"use server";

import { generateInviteToken, inviteExpiryFromNow, inviteUrl } from "@/lib/team-invites";
import { getSiteUrlStatus } from "@/lib/site-url";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { requireAdmin } from "@/lib/auth/admin";
import { adminUrlWith } from "@/lib/admin-messages";
import { createSessionClient } from "@/lib/supabase/server";
import { loginSchema, safeAdminRedirect } from "@/lib/validation/auth";
import {
  errorState,
  formString,
  formValues,
  isUuid,
  issuesToFieldErrors,
  type ActionState,
} from "@/lib/validation/common";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Keeps redirects inside the admin application.
 * Prevents user-controlled `returnTo` values from becoming open redirects.
 */
function adminUrlWith(
  returnTo: string,
  params: Record<string, string>,
): string {
  const fallback = "/admin/volunteers";

  let pathname = fallback;

  try {
    const url = new URL(returnTo, "http://localhost");

    // Only allow internal paths.
    if (
      url.origin === "http://localhost" &&
      url.pathname.startsWith("/admin")
    ) {
      pathname = url.pathname;
    }
  } catch {
    pathname = fallback;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, value);
  }

  const query = searchParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Ensures the current authenticated Supabase user is listed in admin_users.
 */
async function requireAdmin() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = await createSessionClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/admin/login");
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    console.error("requireAdmin failed:", adminError);
    redirect("/admin/login?error=authorization");
  }

  if (!adminRow) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not-admin");
  }

  return {
    supabase,
    user,
  };
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return errorState(
      "Supabase is not configured yet. Set the environment variables listed in .env.example.",
    );
  }

  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields.",
      issuesToFieldErrors(parsed.error.issues),
      formValues(formData),
    );
  }

  const supabase = await createSessionClient();

  const { data, error } = await supabase.auth.signInWithPassword(
    parsed.data,
  );

  if (error || !data.user) {
    if (error?.status === 429) {
      return errorState(
        "Too many attempts. Wait a few minutes and try again.",
        undefined,
        formValues(formData),
      );
    }

    return errorState(
      "The email or password is incorrect.",
      undefined,
      formValues(formData),
    );
  }

  /*
   * Authentication alone does not grant administrator access.
   * The authenticated user's UUID must exist in admin_users.
   */
  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) {
    console.error("Admin authorization check failed:", adminError);

    await supabase.auth.signOut();

    return errorState(
      "We could not verify administrator access. Please try again.",
      undefined,
      formValues(formData),
    );
  }

  if (!adminRow) {
    await supabase.auth.signOut();

    return errorState(
      "This account is not an administrator of the directory.",
      undefined,
      formValues(formData),
    );
  }

  redirect(safeAdminRedirect(formString(formData, "next")));
}

/* -------------------------------------------------------------------------- */
/* Sign out                                                                   */
/* -------------------------------------------------------------------------- */

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }

  redirect("/admin/login");
}

/* -------------------------------------------------------------------------- */
/* Invite types                                                               */
/* -------------------------------------------------------------------------- */

export type InviteActionResult =
  | {
      ok: true;
      url: string;
    }
  | {
      ok: false;
      error: string;
    };

/* -------------------------------------------------------------------------- */
/* Create upload invite                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Generates a new team-upload link.
 *
 * The raw token is returned only once.
 * Only the SHA-256 token hash is stored in the database.
 */
export async function createUploadInvite(): Promise<InviteActionResult> {
  const { supabase, user } = await requireAdmin();

  const site = getSiteUrlStatus();

  if (!site.url) {
    return {
      ok: false,
      error: "Set NEXT_PUBLIC_SITE_URL before generating links.",
    };
  }

  const { rawToken, tokenHash } = await generateInviteToken();

  const { error } = await supabase.from("team_invites").insert({
    token_hash: tokenHash,
    type: "upload",
    expires_at: inviteExpiryFromNow(),
    created_by: user.id,
  });

  if (error) {
    console.error("createUploadInvite failed:", error);

    return {
      ok: false,
      error: "Could not create the link. Try again.",
    };
  }

  return {
    ok: true,
    url: inviteUrl("upload", rawToken, site.url),
  };
}

/* -------------------------------------------------------------------------- */
/* Create update invite                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Generates a team-update link scoped to one existing volunteer.
 */
export async function createUpdateInvite(
  volunteerId: string,
): Promise<InviteActionResult> {
  const { supabase, user } = await requireAdmin();

  if (!isUuid(volunteerId)) {
    return {
      ok: false,
      error: "This volunteer could not be found.",
    };
  }

  const site = getSiteUrlStatus();

  if (!site.url) {
    return {
      ok: false,
      error: "Set NEXT_PUBLIC_SITE_URL before generating links.",
    };
  }

  /*
   * Verify the volunteer actually exists before creating an update invite.
   */
  const { data: volunteer, error: volunteerError } = await supabase
    .from("volunteers")
    .select("id")
    .eq("id", volunteerId)
    .maybeSingle();

  if (volunteerError) {
    console.error(
      "createUpdateInvite volunteer lookup failed:",
      volunteerError,
    );

    return {
      ok: false,
      error: "Could not verify this volunteer.",
    };
  }

  if (!volunteer) {
    return {
      ok: false,
      error: "This volunteer could not be found.",
    };
  }

  const { rawToken, tokenHash } = await generateInviteToken();

  const { error } = await supabase.from("team_invites").insert({
    token_hash: tokenHash,
    type: "update",
    volunteer_id: volunteerId,
    expires_at: inviteExpiryFromNow(),
    created_by: user.id,
  });

  if (error) {
    console.error("createUpdateInvite failed:", error);

    return {
      ok: false,
      error: "Could not create the link. Try again.",
    };
  }

  return {
    ok: true,
    url: inviteUrl("update", rawToken, site.url),
  };
}

/* -------------------------------------------------------------------------- */
/* Revoke invite                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Revokes an invite before it expires or is used.
 */
export async function revokeInvite(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const returnTo =
    formString(formData, "returnTo") || "/admin/volunteers";

  const id = formString(formData, "id");

  if (!isUuid(id)) {
    redirect(
      adminUrlWith(returnTo, {
        error: "not-found",
      }),
    );
  }

  const { error } = await supabase
    .from("team_invites")
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("revokeInvite failed:", error);

    redirect(
      adminUrlWith(returnTo, {
        error: "failed",
      }),
    );
  }

  revalidatePath("/admin/volunteers");

  redirect(
    adminUrlWith(returnTo, {
      notice: "invite-revoked",
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Approve submission                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Approves:
 *
 * 1. A new pending volunteer submission
 * 2. A pending update by merging its staged changes into the live record
 */
export async function approveSubmission(
  formData: FormData,
): Promise<void> {
  const { supabase } = await requireAdmin();

  const returnTo =
    formString(formData, "returnTo") || "/admin/volunteers";

  const id = formString(formData, "id");

  if (!isUuid(id)) {
    redirect(
      adminUrlWith(returnTo, {
        error: "not-found",
      }),
    );
  }

  const { data: existing, error: readError } = await supabase
    .from("volunteers")
    .select(
      "submission_status, pending_changes, consent_status",
    )
    .eq("id", id)
    .maybeSingle();

  if (readError || !existing) {
    if (readError) {
      console.error(
        "approveSubmission read failed:",
        readError,
      );
    }

    redirect(
      adminUrlWith(returnTo, {
        error: "not-found",
      }),
    );
  }

  const row = existing as {
    submission_status: string;
    pending_changes: Record<string, unknown> | null;
    consent_status: string;
  };

  /*
   * Consent is required before any submission can become publicly approved.
   */
  if (row.consent_status !== "granted") {
    redirect(
      adminUrlWith(returnTo, {
        error: "consent-required",
      }),
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Pending update                                                          */
  /* ---------------------------------------------------------------------- */

  if (
    row.submission_status === "update-pending" &&
    row.pending_changes
  ) {
    const draft = row.pending_changes as {
      full_name?: unknown;
      public_role?: unknown;
      bio?: unknown;
      skills?: unknown;
      social_links?: unknown;
    };

    /*
     * Validate staged JSON before writing it to the live volunteer record.
     */
    if (
      typeof draft.full_name !== "string" ||
      draft.full_name.trim().length === 0
    ) {
      redirect(
        adminUrlWith(returnTo, {
          error: "invalid-submission",
        }),
      );
    }

    const publicRole =
      draft.public_role === null ||
      typeof draft.public_role === "string"
        ? draft.public_role
        : null;

    const bio =
      draft.bio === null ||
      typeof draft.bio === "string"
        ? draft.bio
        : null;

    const skills = Array.isArray(draft.skills)
      ? draft.skills.filter(
          (skill): skill is string => typeof skill === "string",
        )
      : [];

    const socialLinks =
      draft.social_links &&
      typeof draft.social_links === "object" &&
      !Array.isArray(draft.social_links)
        ? draft.social_links
        : {};

    const { error } = await supabase
      .from("volunteers")
      .update({
        full_name: draft.full_name.trim(),
        public_role: publicRole,
        bio,
        skills,
        social_links: socialLinks,
        submission_status: "approved",
        pending_changes: null,
      })
      .eq("id", id);

    if (error) {
      console.error(
        "approveSubmission (update) failed:",
        error,
      );

      redirect(
        adminUrlWith(returnTo, {
          error: "failed",
        }),
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* New pending submission                                                  */
  /* ---------------------------------------------------------------------- */

  else {
    const { error } = await supabase
      .from("volunteers")
      .update({
        submission_status: "approved",
      })
      .eq("id", id);

    if (error) {
      console.error(
        "approveSubmission failed:",
        error,
      );

      redirect(
        adminUrlWith(returnTo, {
          error: "failed",
        }),
      );
    }
  }

  revalidatePath("/admin/volunteers");
  revalidatePath("/");

  redirect(
    adminUrlWith(returnTo, {
      notice: "submission-approved",
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Reject submission                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Rejects a pending new submission.
 *
 * For an update-pending record, the staged changes are simply discarded and
 * the existing approved volunteer record remains unchanged.
 */
export async function rejectSubmission(
  formData: FormData,
): Promise<void> {
  const { supabase } = await requireAdmin();

  const returnTo =
    formString(formData, "returnTo") || "/admin/volunteers";

  const id = formString(formData, "id");

  if (!isUuid(id)) {
    redirect(
      adminUrlWith(returnTo, {
        error: "not-found",
      }),
    );
  }

  const { data: existing, error: readError } = await supabase
    .from("volunteers")
    .select("submission_status")
    .eq("id", id)
    .maybeSingle();

  if (readError || !existing) {
    if (readError) {
      console.error(
        "rejectSubmission read failed:",
        readError,
      );
    }

    redirect(
      adminUrlWith(returnTo, {
        error: "not-found",
      }),
    );
  }

  const wasUpdate =
    (existing as { submission_status: string })
      .submission_status === "update-pending";

  const { error } = await supabase
    .from("volunteers")
    .update(
      wasUpdate
        ? {
            submission_status: "approved",
            pending_changes: null,
          }
        : {
            submission_status: "rejected",
            is_published: false,
          },
    )
    .eq("id", id);

  if (error) {
    console.error(
      "rejectSubmission failed:",
      error,
    );

    redirect(
      adminUrlWith(returnTo, {
        error: "failed",
      }),
    );
  }

  revalidatePath("/admin/volunteers");
  revalidatePath("/");

  redirect(
    adminUrlWith(returnTo, {
      notice: "submission-rejected",
    }),
  );
}
