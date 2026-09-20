"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-16">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="mt-4 text-lg text-mist">The page could not be loaded. This is a problem on our side, not yours.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn">
          Go to the directory
        </Link>
      </div>
    </main>
  );
}
