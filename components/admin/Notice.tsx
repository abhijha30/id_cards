import { errorText, noticeText } from "@/lib/admin-messages";

/** Renders a notice or error from ?notice= / ?error= codes, using only the fixed message catalogue. */
export function Notice({ notice, error }: { notice?: string | string[]; error?: string | string[] }) {
  const errorMessage = errorText(error);
  const noticeMessage = noticeText(notice);
  if (errorMessage) {
    return (
      <p role="alert" className="mb-6 rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
        {errorMessage}
      </p>
    );
  }
  if (noticeMessage) {
    return (
      <p role="status" className="mb-6 rounded-xl border border-ok/50 bg-ok/10 px-4 py-3 text-sm text-ok">
        {noticeMessage}
      </p>
    );
  }
  return null;
}
