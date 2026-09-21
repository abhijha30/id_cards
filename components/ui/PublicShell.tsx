import Link from "next/link";
import { BRAND_LOGO_SRC, ORG_NAME } from "@/lib/config";
import { BrandMark } from "@/components/ui/BrandMark";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg">
            <BrandMark />
            {!BRAND_LOGO_SRC && <span className="font-display text-lg font-semibold tracking-tight">{ORG_NAME}</span>}
            <span className="hidden text-sm text-dim sm:inline">Volunteer directory</span>
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-dim sm:px-8">
          <p>Only volunteers who agreed to be listed appear here.</p>
          <Link href="/privacy" className="rounded text-mist underline decoration-line-strong underline-offset-4 hover:text-fog">
            Privacy and removal requests
          </Link>
        </div>
      </footer>
    </div>
  );
}
