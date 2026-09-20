/** Normalises a visitor's search text: trims, collapses spaces, strips control characters, caps length. */
export function normalizeSearchText(raw: string | undefined | null, maxLength = 80): string {
  return (raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Escapes LIKE wildcards so "100%" or "a_b" is matched literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Splits a query into at most 5 word tokens. Every token must appear in the name, in any order,
 * so "lovelace ada" finds "Ada Lovelace".
 */
export function searchTokens(query: string): string[] {
  return normalizeSearchText(query)
    .split(" ")
    .filter(Boolean)
    .slice(0, 5);
}
