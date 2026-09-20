export type Accent = "blue" | "red" | "yellow" | "green";

const ACCENTS: Accent[] = ["blue", "red", "yellow", "green"];

/** Stable accent colour per team so a team always looks the same across the site. */
export function teamAccent(slug: string | null | undefined): Accent {
  if (!slug) return "blue";
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? "blue";
}

export function accentVar(accent: Accent): string {
  return `var(--color-g-${accent})`;
}
