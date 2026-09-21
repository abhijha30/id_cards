import { BRAND_LOGO_SRC } from "@/lib/config";
/**
 * Logo slot. Shows the approved logo when BRAND_LOGO_SRC is set in lib/config.ts.
 * Until then it renders a neutral placeholder tile. This is NOT the GDG logo and must be
 * replaced with the organisers' approved asset before launch.
 */
export function BrandMark({ className = "" }: { className?: string }) {
    if (BRAND_LOGO_SRC) {
    // The official logo has dark text, so it sits on a white chip to stay readable on the dark theme.
    return (
      <span className={`inline-flex items-center rounded-xl ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO_SRC} alt="Google Developer Groups Noida" className="h-6 w-auto sm:h-7" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 grid-cols-2 gap-[3px] rounded-[0.7rem] border border-line-strong bg-coal-2 p-[6px] ${className}`}
    >
      <span className="rounded-full bg-g-blue" />
      <span className="rounded-full bg-g-red" />
      <span className="rounded-full bg-g-yellow" />
      <span className="rounded-full bg-g-green" />
    </span>
  );
}
