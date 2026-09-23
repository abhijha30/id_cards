"use client";

/**
 * Small LinkedIn glyph shown next to a name. Renders nothing when there is no LinkedIn URL —
 * this is the only requested change to the existing social system; SocialLinks.tsx is untouched.
 */
export function LinkedInIcon({ url, name }: { url: string | undefined; name: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      aria-label={`${name} on LinkedIn`}
      onClick={(event) => event.stopPropagation()}
      className="ml-10 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#0A66C2] hover:opacity-80"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
      </svg>
    </a>
  );
}
