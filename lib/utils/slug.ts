/** Lowercase kebab-case ASCII slug. Returns "" when nothing usable remains. */
export function slugify(input: string, maxLength = 60): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string, maxLength = 80): boolean {
  return value.length > 0 && value.length <= maxLength && SLUG_PATTERN.test(value);
}

/**
 * Slugs to try in order when inserting: base, base-2, base-3, ... then a random suffix.
 * The database UNIQUE constraint is the real arbiter; this just avoids most collisions.
 */
export function slugCandidates(base: string, fallback: string, attempts = 8): string[] {
  const root = base || fallback;
  const list = [root];
  for (let n = 2; n <= attempts; n += 1) list.push(`${root.slice(0, 70)}-${n}`);
  list.push(`${root.slice(0, 70)}-${crypto.randomUUID().slice(0, 6)}`);
  return list;
}
