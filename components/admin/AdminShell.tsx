import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { BrandMark } from "@/components/ui/BrandMark";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/volunteers", label: "Volunteers" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/qr", label: "Master QR" },
];

export function AdminShell({ email, children }: { email: string | undefined; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="no-print border-b border-line bg-coal">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8">
          <Link href="/admin" className="flex items-center gap-3 rounded-lg">
            <BrandMark />
            <span className="font-display text-base font-semibold">Directory admin</span>
          </Link>
          <nav aria-label="Admin" className="flex flex-1 flex-wrap gap-1">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="btn btn-quiet btn-sm">
                {item.label}
              </Link>
            ))}
            <Link href="/" className="btn btn-quiet btn-sm">
              View public site
            </Link>
          </nav>
          <form action={signOut} className="flex items-center gap-3">
            {email && <span className="hidden text-sm text-dim md:inline">{email}</span>}
            <button type="submit" className="btn btn-sm">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
