import { describe, expect, it } from "vitest";
import { normalizeSocialUrl } from "@/lib/social";
import { displayUrl, safeExternalUrl } from "@/lib/utils/safe-url";

describe("normalizeSocialUrl", () => {
  it("accepts platform URLs and adds https when the scheme is missing", () => {
    expect(normalizeSocialUrl("github", "https://github.com/ada")).toEqual({ ok: true, url: "https://github.com/ada" });
    expect(normalizeSocialUrl("linkedin", "linkedin.com/in/ada")).toEqual({ ok: true, url: "https://linkedin.com/in/ada" });
    expect(normalizeSocialUrl("linkedin", "https://in.linkedin.com/in/ada").ok).toBe(true);
    expect(normalizeSocialUrl("x", "https://twitter.com/ada").ok).toBe(true);
    expect(normalizeSocialUrl("youtube", "https://youtu.be/abc").ok).toBe(true);
  });

  it("rejects dangerous schemes", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "http://github.com/ada", "ftp://github.com/ada", "vbscript:x"]) {
      expect(normalizeSocialUrl("github", bad).ok, bad).toBe(false);
    }
  });

  it("rejects embedded credentials, spaces and look-alike hosts", () => {
    expect(normalizeSocialUrl("github", "https://user:pw@github.com/ada").ok).toBe(false);
    expect(normalizeSocialUrl("github", "https://github.com/a b").ok).toBe(false);
    expect(normalizeSocialUrl("github", "https://github.com.evil.example/ada").ok).toBe(false);
    expect(normalizeSocialUrl("github", "https://notgithub.com/ada").ok).toBe(false);
  });

  it("requires the host to belong to the chosen platform", () => {
    expect(normalizeSocialUrl("instagram", "https://github.com/ada").ok).toBe(false);
  });

  it("allows any public host for a personal website but not local or IP addresses", () => {
    expect(normalizeSocialUrl("website", "https://ada.dev/about").ok).toBe(true);
    expect(normalizeSocialUrl("website", "https://localhost/x").ok).toBe(false);
    expect(normalizeSocialUrl("website", "https://127.0.0.1/x").ok).toBe(false);
    expect(normalizeSocialUrl("website", "https://192.168.1.4/x").ok).toBe(false);
    expect(normalizeSocialUrl("website", "https://intranet/x").ok).toBe(false);
    expect(normalizeSocialUrl("website", "https://printer.local/x").ok).toBe(false);
  });

  it("rejects overlong links", () => {
    expect(normalizeSocialUrl("website", `https://example.com/${"a".repeat(300)}`).ok).toBe(false);
  });
});

describe("safeExternalUrl (render-time defence)", () => {
  it("only lets https URLs through", () => {
    expect(safeExternalUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("http://example.com")).toBeNull();
    expect(safeExternalUrl("https://u:p@example.com")).toBeNull();
    expect(safeExternalUrl(42)).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
  });
  it("shortens URLs for display", () => {
    expect(displayUrl("https://www.github.com/ada/")).toBe("github.com/ada");
  });
});
