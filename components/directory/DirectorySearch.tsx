"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { directoryHref } from "@/lib/directory-params";

type Props = { initialQuery: string; team: string | null };

/**
 * Search box. Works without JavaScript (plain GET form) and, with JavaScript, updates the
 * results as you type after a short pause. Filtering itself always happens on the server.
 */
export function DirectorySearch({ initialQuery, team }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the URL's query when it changes from outside (for example a "clear" link), but
  // ignore changes that came from our own typing so we never overwrite newer keystrokes.
  const [syncedProp, setSyncedProp] = useState(initialQuery);
  const [lastPushed, setLastPushed] = useState(initialQuery);
  if (initialQuery !== syncedProp) {
    setSyncedProp(initialQuery);
    if (initialQuery !== lastPushed) {
      setValue(initialQuery);
      setLastPushed(initialQuery);
    }
  }

  function push(next: string) {
    const trimmed = next.trim();
    setLastPushed(trimmed);
    startTransition(() => {
      router.replace(directoryHref({ q: trimmed, team }), { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), 280);
  }

  return (
    <form
      role="search"
      action="/"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        push(value);
      }}
    >
      {team && <input type="hidden" name="team" value={team} />}
      <label htmlFor="volunteer-search" className="sr-only">
        Search volunteers by name
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-dim"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="volunteer-search"
          name="q"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type a name"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={80}
          enterKeyHint="search"
          aria-busy={pending}
          className="h-16 w-full rounded-[1.2rem] border border-line-strong bg-coal pl-14 pr-5 text-lg text-fog placeholder:text-dim hover:border-mist"
        />
      </div>
      <noscript>
        <button type="submit" className="btn mt-3">
          Search
        </button>
      </noscript>
    </form>
  );
}
