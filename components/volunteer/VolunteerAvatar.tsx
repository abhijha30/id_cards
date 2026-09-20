"use client";

import { useState } from "react";
import { initials } from "@/lib/utils/initials";
import { accentVar, type Accent } from "@/lib/utils/team-accent";

type Props = {
  slug: string;
  name: string;
  hasPhoto: boolean;
  /** Changes when the profile changes, so a replaced photo is not served from cache. */
  version: string;
  accent: Accent;
  priority?: boolean;
  className?: string;
};

/** 4:5 portrait. Falls back to initials when there is no photo or it fails to load. */
export function VolunteerAvatar({ slug, name, hasPhoto, version, accent, priority = false, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const showPhoto = hasPhoto && !failed;
  const color = accentVar(accent);

  return (
    <div
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-[1.05rem] bg-coal-2 ${className}`}
      style={{ backgroundImage: `linear-gradient(0deg, color-mix(in srgb, ${color} 14%, transparent), color-mix(in srgb, ${color} 14%, transparent))` }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/photos/${slug}?v=${encodeURIComponent(version)}`}
          alt={name}
          width={480}
          height={600}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" role="img" aria-label={`${name} (no photo)`}>
          <span className="font-display text-5xl font-semibold tracking-tight" style={{ color }}>
            {initials(name)}
          </span>
        </div>
      )}
    </div>
  );
}
