import { describe, expect, it } from "vitest";
import { isValidSlug, slugCandidates, slugify } from "@/lib/utils/slug";
import { escapeLikePattern, normalizeSearchText, searchTokens } from "@/lib/utils/search";
import { directoryHref, parseDirectoryParams } from "@/lib/directory-params";

describe("slugify", () => {
  it("makes lowercase kebab-case", () => {
    expect(slugify("Ada Lovelace")).toBe("ada-lovelace");
    expect(slugify("  Mary-Jane   O'Neil  ")).toBe("mary-jane-o-neil");
  });
  it("strips accents and symbols", () => {
    expect(slugify("José Ñandú")).toBe("jose-nandu");
    expect(slugify("R&D Team")).toBe("r-and-d-team");
  });
  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("अविनाश")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
  it("respects the maximum length without a trailing dash", () => {
    const slug = slugify("a".repeat(30) + " " + "b".repeat(30), 31);
    expect(slug.length).toBeLessThanOrEqual(31);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slugCandidates", () => {
  it("tries the base first, then numbered variants, then a random suffix", () => {
    const list = slugCandidates("ada-lovelace", "volunteer");
    expect(list[0]).toBe("ada-lovelace");
    expect(list[1]).toBe("ada-lovelace-2");
    expect(list.length).toBe(9);
    expect(list.every((s) => isValidSlug(s))).toBe(true);
  });
  it("uses the fallback for empty bases", () => {
    expect(slugCandidates("", "volunteer")[0]).toBe("volunteer");
  });
});

describe("search text handling", () => {
  it("normalises whitespace, control characters and length", () => {
    expect(normalizeSearchText("  ada \n\t love  ")).toBe("ada love");
    expect(normalizeSearchText("x".repeat(200))).toHaveLength(80);
    expect(normalizeSearchText(undefined)).toBe("");
  });
  it("escapes LIKE wildcards so they match literally", () => {
    expect(escapeLikePattern("100%_done\\")).toBe("100\\%\\_done\\\\");
  });
  it("splits into at most five tokens", () => {
    expect(searchTokens("a b c d e f g")).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("directory URL parameters", () => {
  it("sanitises untrusted input", () => {
    expect(parseDirectoryParams({ q: "  Ada  ", team: "Not A Slug!", page: "-4" })).toEqual({ q: "Ada", team: null, page: 1 });
    expect(parseDirectoryParams({ q: ["first", "second"], team: "design", page: "abc" })).toEqual({ q: "first", team: "design", page: 1 });
    expect(parseDirectoryParams({ page: "999999" }).page).toBe(1000);
  });
  it("builds links without empty parameters", () => {
    expect(directoryHref({})).toBe("/");
    expect(directoryHref({ q: "ada", team: "design", page: 3 })).toBe("/?q=ada&team=design&page=3");
    expect(directoryHref({ q: "a b" })).toBe("/?q=a+b");
    expect(directoryHref({ q: "ada", page: 1 })).toBe("/?q=ada");
  });
});
