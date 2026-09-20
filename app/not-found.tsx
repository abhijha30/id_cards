import Link from "next/link";
import { PublicShell } from "@/components/ui/PublicShell";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold">Page not found</h1>
        <p className="mt-4 text-lg text-mist">That address does not lead anywhere. Head back to the directory to search for a volunteer.</p>
        <Link href="/" className="btn btn-primary mt-6">
          Go to the directory
        </Link>
      </div>
    </PublicShell>
  );
}
