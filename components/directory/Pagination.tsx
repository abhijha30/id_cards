import Link from "next/link";
import { directoryHref } from "@/lib/directory-params";

type Props = { page: number; pageCount: number; q: string; team: string | null };

export function Pagination({ page, pageCount, q, team }: Props) {
  if (pageCount <= 1) return null;
  const link = "btn";
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={directoryHref({ q, team, page: page - 1 })} rel="prev" className={link}>
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <p className="text-sm text-mist">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={directoryHref({ q, team, page: page + 1 })} rel="next" className={link}>
          Next
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
