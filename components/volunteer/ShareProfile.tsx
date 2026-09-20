"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export function ShareProfile({ name }: { name: string }) {
  const [status, setStatus] = useState<string>("");
  const nativeShare = useSyncExternalStore(subscribe, canNativeShare, () => false);

  const profileUrl = () => `${window.location.origin}${window.location.pathname}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(profileUrl());
      setStatus("Link copied.");
    } catch {
      setStatus("Could not copy automatically. Copy the address from your browser's address bar.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `${name} | GDG Noida`, url: profileUrl() });
    } catch {
      // The person closed the share sheet. Nothing to report.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {nativeShare && (
        <button type="button" onClick={share} className="btn">
          Share profile
        </button>
      )}
      <button type="button" onClick={copy} className="btn">
        Copy link
      </button>
      <p role="status" aria-live="polite" className="text-sm text-mist">
        {status}
      </p>
    </div>
  );
}
