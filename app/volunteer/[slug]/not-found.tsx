import Link from "next/link";
import { PublicShell } from "@/components/ui/PublicShell";

export default function VolunteerNotFound() {
  return (
    <PublicShell>
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold">This profile is not available</h1>
        <p className="mt-4 text-lg text-mist">
          The link may be mistyped, or the volunteer may not be listed. Search the directory by name to check.
        </p>
        <Link href="/" className="btn btn-primary mt-6">
          Search the directory
        </Link>
      </div>
    </PublicShell>
  );
}
