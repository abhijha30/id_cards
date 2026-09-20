import { describe, expect, it } from "vitest";
import { evaluateSiteUrl } from "@/lib/site-url";

describe("evaluateSiteUrl", () => {
  it("rejects a missing value", () => {
    const status = evaluateSiteUrl(undefined);
    expect(status.configured).toBe(false);
    expect(status.url).toBeNull();
    expect(status.error).toMatch(/not set/i);
  });

  it("rejects values that are not absolute URLs", () => {
    expect(evaluateSiteUrl("directory.example.org").configured).toBe(false);
    expect(evaluateSiteUrl("not a url").configured).toBe(false);
  });

  it("rejects non-http(s) schemes and embedded credentials", () => {
    expect(evaluateSiteUrl("javascript:alert(1)").configured).toBe(false);
    expect(evaluateSiteUrl("ftp://example.org").configured).toBe(false);
    expect(evaluateSiteUrl("https://user:pw@example.org").configured).toBe(false);
  });

  it("accepts a clean https URL without warnings and preserves it exactly", () => {
    const status = evaluateSiteUrl("  https://directory.example.org  ");
    expect(status).toEqual({ url: "https://directory.example.org", configured: true, error: null, warnings: [] });
  });

  it("warns loudly about localhost", () => {
    const status = evaluateSiteUrl("http://localhost:3000");
    expect(status.configured).toBe(true);
    expect(status.warnings.join(" ")).toMatch(/only works on your own computer/i);
  });

  it("warns about plain http on a public host", () => {
    expect(evaluateSiteUrl("http://directory.example.org").warnings.join(" ")).toMatch(/http:\/\//);
  });

  it("warns about query strings", () => {
    expect(evaluateSiteUrl("https://directory.example.org/?x=1").warnings.join(" ")).toMatch(/query string/i);
  });
});
