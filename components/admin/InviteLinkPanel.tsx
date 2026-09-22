"use client";

import { useState, useTransition } from "react";

type Props = {
  label: string;
  generate: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
};

export function InviteLinkPanel({ label, generate }: Props) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generate();
      if (result.ok) setUrl(result.url);
      else setError(result.error);
    });
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="space-y-3">
      <button type="button" className="btn btn-sm" onClick={handleGenerate} disabled={pending}>
        {pending ? "Generating..." : label}
      </button>
      {error && <p className="field-error">{error}</p>}
      {url && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-strong p-3">
          <code className="min-w-0 flex-1 break-all text-sm text-mist">{url}</code>
          <button type="button" className="btn btn-sm" onClick={handleCopy}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      <p className="text-sm text-dim">Valid 24 hours, single use. Send it privately — it isn&rsquo;t listed anywhere.</p>
    </div>
  );
}
