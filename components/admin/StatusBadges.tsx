import { CONSENT_LABELS, type ConsentStatus } from "@/lib/validation/volunteer";

const pill = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";

export function PublishedBadge({ published }: { published: boolean }) {
  return published ? (
    <span className={`${pill} border-ok/50 text-ok`}>Published</span>
  ) : (
    <span className={`${pill} border-line-strong text-mist`}>Not published</span>
  );
}

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  const tone =
    status === "granted" ? "border-ok/50 text-ok" : status === "withdrawn" ? "border-danger/50 text-danger" : "border-g-yellow/60 text-g-yellow";
  return <span className={`${pill} ${tone}`}>Consent: {CONSENT_LABELS[status].toLowerCase()}</span>;
}
