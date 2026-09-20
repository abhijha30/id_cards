import { describe, expect, it } from "vitest";
import { parseSkills, parseVolunteerForm } from "@/lib/validation/volunteer";
import { parseTeamForm } from "@/lib/validation/team";
import { loginSchema, safeAdminRedirect } from "@/lib/validation/auth";
import { adminUrlWith, errorText, noticeText } from "@/lib/admin-messages";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const TEAM = "11111111-1111-4111-8111-111111111111";
const valid = { full_name: "Ada Lovelace", consent_status: "granted" };

describe("parseVolunteerForm", () => {
  it("accepts a minimal valid form and cleans the values", () => {
    const result = parseVolunteerForm(
      form({ ...valid, full_name: "  Ada   Lovelace ", team_id: TEAM, public_role: " Lead ", bio: "", skills: "Maths, maths, Writing;  ", is_published: "on" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      full_name: "Ada Lovelace",
      team_id: TEAM,
      public_role: "Lead",
      bio: null,
      skills: ["Maths", "Writing"],
      consent_status: "granted",
      is_published: true,
    });
  });

  it("requires a name of at least two characters", () => {
    const result = parseVolunteerForm(form({ ...valid, full_name: " A " }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.full_name).toBeDefined();
  });

  it("rejects an unknown consent status and a malformed team id", () => {
    const status = parseVolunteerForm(form({ ...valid, consent_status: "maybe" }));
    expect(status.ok).toBe(false);
    const team = parseVolunteerForm(form({ ...valid, team_id: "not-a-uuid" }));
    expect(team.ok).toBe(false);
    if (!team.ok) expect(team.fieldErrors.team_id).toBeDefined();
  });

  it("enforces bio and skill limits", () => {
    expect(parseVolunteerForm(form({ ...valid, bio: "x".repeat(601) })).ok).toBe(false);
    const many = Array.from({ length: 16 }, (_, i) => `skill${i}`).join(",");
    const tooMany = parseVolunteerForm(form({ ...valid, skills: many }));
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.fieldErrors.skills).toMatch(/at most 15/);
    const longSkill = parseVolunteerForm(form({ ...valid, skills: "y".repeat(41) }));
    expect(longSkill.ok).toBe(false);
  });

  it("stores social links with their approval flag and validates each platform", () => {
    const ok = parseVolunteerForm(
      form({ ...valid, social_github_url: "https://github.com/ada", social_github_approved: "on", social_linkedin_url: "https://linkedin.com/in/ada" }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.social_links.github).toEqual({ url: "https://github.com/ada", approved: true });
      expect(ok.data.social_links.linkedin).toEqual({ url: "https://linkedin.com/in/ada", approved: false });
    }

    const bad = parseVolunteerForm(form({ ...valid, social_github_url: "javascript:alert(1)", social_x_url: "https://evil.example/x" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.fieldErrors.social_github_url).toBeDefined();
      expect(bad.fieldErrors.social_x_url).toBeDefined();
    }
  });

  it("ignores approval flags on empty links", () => {
    const result = parseVolunteerForm(form({ ...valid, social_github_approved: "on" }));
    expect(result.ok && Object.keys(result.data.social_links)).toEqual([]);
  });

  it("never publishes without granted consent (withdrawing consent takes a profile down)", () => {
    for (const consent_status of ["pending", "withdrawn"]) {
      const result = parseVolunteerForm(form({ full_name: "Ada Lovelace", consent_status, is_published: "on" }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.is_published).toBe(false);
        expect(result.notice).toMatch(/unpublished/);
      }
    }
  });
});

describe("parseSkills", () => {
  it("splits on commas, semicolons and new lines, de-duplicating case-insensitively", () => {
    expect(parseSkills("React, react;Design\nDesign,  , Public speaking")).toEqual(["React", "Design", "Public speaking"]);
  });
});

describe("parseTeamForm", () => {
  it("validates name and description", () => {
    expect(parseTeamForm(form({ name: "Design", is_active: "on" }))).toEqual({
      ok: true,
      data: { name: "Design", description: null, is_active: true },
    });
    expect(parseTeamForm(form({ name: "D" })).ok).toBe(false);
    expect(parseTeamForm(form({ name: "Design", description: "x".repeat(301) })).ok).toBe(false);
  });
});

describe("login and redirects", () => {
  it("validates credentials shape", () => {
    expect(loginSchema.safeParse({ email: "admin@example.org", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "admin@example.org", password: "" }).success).toBe(false);
  });

  it("only redirects inside /admin (no open redirects)", () => {
    expect(safeAdminRedirect("/admin/volunteers")).toBe("/admin/volunteers");
    expect(safeAdminRedirect(undefined)).toBe("/admin");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/admin/../x://y", "/other", "/admin/login"]) {
      expect(safeAdminRedirect(bad), bad).toBe("/admin");
    }
  });

  it("renders only catalogued messages and builds safe return URLs", () => {
    expect(noticeText("saved")).toBe("Changes saved.");
    expect(noticeText("<script>alert(1)</script>")).toBeNull();
    expect(errorText("consent-required")).toMatch(/consent/i);
    expect(errorText(undefined)).toBeNull();
    expect(adminUrlWith("/admin/volunteers?q=ada&notice=old", { notice: "saved" })).toBe("/admin/volunteers?q=ada&notice=saved");
    expect(adminUrlWith("https://evil.example", { error: "failed" })).toBe("/admin?error=failed");
  });
});
