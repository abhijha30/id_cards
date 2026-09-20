import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDashboardCounts } from "@/lib/data/admin";
import { getSiteUrlStatus } from "@/lib/site-url";

export const metadata = { title: "Overview" };

export default async function AdminDashboard() {
  const { supabase } = await requireAdmin();
  const counts = await getDashboardCounts(supabase).catch((error) => {
    console.error(error);
    return null;
  });
  const site = getSiteUrlStatus();

  const stats = counts
    ? [
        { label: "Volunteers", value: counts.total, href: "/admin/volunteers" },
        { label: "Published", value: counts.published, href: "/admin/volunteers?status=published" },
        { label: "Not published", value: counts.draft, href: "/admin/volunteers?status=draft" },
        { label: "Consent not granted", value: counts.consentMissing, href: "/admin/volunteers?status=consent-missing" },
        { label: "Teams", value: counts.teams, href: "/admin/teams" },
      ]
    : [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">Overview</h1>
        <p className="mt-2 text-mist">Manage who appears in the public directory.</p>
      </div>

      {(!site.configured || site.warnings.length > 0) && (
        <section aria-labelledby="qr-warning" className="rounded-2xl border border-g-yellow/50 bg-g-yellow/10 p-5">
          <h2 id="qr-warning" className="text-lg font-semibold">
            Check the master QR address before printing
          </h2>
          <p className="mt-1 text-sm text-fog/90">{site.error ?? site.warnings[0]}</p>
          <Link href="/admin/qr" className="btn btn-sm mt-3">
            Open the QR page
          </Link>
        </section>
      )}

      {counts ? (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {stats.map((stat) => (
            <li key={stat.label}>
              <Link href={stat.href} className="panel block p-5 transition-colors hover:border-mist">
                <span className="block font-display text-4xl font-bold">{stat.value}</span>
                <span className="mt-1 block text-sm text-mist">{stat.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          The counts could not be loaded. Check that the database migrations have been applied.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/volunteers/new" className="btn btn-primary">
          Add a volunteer
        </Link>
        <Link href="/admin/teams" className="btn">
          Manage teams
        </Link>
        <Link href="/admin/qr" className="btn">
          Master QR code
        </Link>
      </div>
    </div>
  );
}
