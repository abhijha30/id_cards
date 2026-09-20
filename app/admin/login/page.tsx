import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { BrandMark } from "@/components/ui/BrandMark";
import { getAdminSession } from "@/lib/auth/admin";
import { signOut } from "@/app/admin/actions";
import { safeAdminRedirect } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextParam = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = safeAdminRedirect(nextParam);
  const session = await getAdminSession();

  if (session.status === "admin") redirect(next);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-8 flex items-center gap-3">
        <BrandMark />
        <span className="font-display text-lg font-semibold">Directory admin</span>
      </div>

      <div className="panel p-6 sm:p-8">
        <h1 className="text-3xl font-bold">Sign in</h1>

        {session.status === "unconfigured" ? (
          <div role="alert" className="mt-5 rounded-xl border border-g-yellow/50 bg-g-yellow/10 p-4 text-sm">
            Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then restart the server.
          </div>
        ) : session.status === "not_admin" ? (
          <div className="mt-5 space-y-4">
            <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
              You are signed in as {session.user.email}, but this account is not an administrator of the directory.
            </p>
            <form action={signOut}>
              <button type="submit" className="btn w-full">
                Sign out and use a different account
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-6">
            <LoginForm next={next} />
          </div>
        )}
      </div>

      <Link href="/" className="btn btn-quiet mt-6 self-start">
        Back to the public directory
      </Link>
    </main>
  );
}
