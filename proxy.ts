import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { refreshSession } from "@/lib/supabase/proxy";

/**
 * Runs only for /admin/*. Public pages never touch cookies, so they stay cacheable and free
 * of any visitor tracking.
 *
 * - Refreshes the admin's session cookie.
 * - Sends signed-out visitors to the login page early.
 *
 * Authorisation is NOT decided here: every admin page and every server action calls
 * requireAdmin() again, and the database enforces RLS.
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    // Let the page render its "setup required" message instead of crashing.
    return NextResponse.next();
  }

  const { response, user } = await refreshSession(request);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login" || pathname === "/admin/login/";

  if (!user && !isLogin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
