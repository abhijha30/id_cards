"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { adminUrlWith } from "@/lib/admin-messages";
import { slugCandidates, slugify } from "@/lib/utils/slug";
import { errorState, formString, formValues, isUuid, successState, type ActionState } from "@/lib/validation/common";
import { parseTeamForm } from "@/lib/validation/team";

const GENERIC = "The team could not be saved. Try again.";

/** Creates a team (no id) or updates one (id present). The slug is fixed at creation. */
export async function saveTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();

  const parsed = parseTeamForm(formData);
  if (!parsed.ok) return errorState("Some fields need attention.", parsed.fieldErrors, formValues(formData));

  const id = formString(formData, "id");

  if (id) {
    if (!isUuid(id)) return errorState("This team could not be found.");
    const { error } = await supabase.from("teams").update(parsed.data).eq("id", id);
    if (error) {
      if (error.code === "23505") return errorState("Another team already uses this name.", { name: "Another team already uses this name." });
      console.error("saveTeam update failed", error);
      return errorState(GENERIC);
    }
    revalidatePath("/admin/teams");
    return successState("Team saved.");
  }

  for (const slug of slugCandidates(slugify(parsed.data.name, 50), "team")) {
    const { error } = await supabase.from("teams").insert({ ...parsed.data, slug });
    if (!error) {
      revalidatePath("/admin/teams");
      return successState(`Team "${parsed.data.name}" created.`);
    }

    const detail = `${error.message} ${error.details ?? ""}`;
    if (error.code === "23505" && detail.includes("teams_slug_key")) continue;
    if (error.code === "23505") return errorState("Another team already uses this name.", { name: "Another team already uses this name." });
    console.error("saveTeam insert failed", error);
    return errorState(GENERIC);
  }
  return errorState(GENERIC);
}

export async function deleteTeam(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = formString(formData, "id");
  if (!isUuid(id)) redirect(adminUrlWith("/admin/teams", { error: "not-found" }));

  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") redirect(adminUrlWith("/admin/teams", { error: "team-has-volunteers" }));
    console.error("deleteTeam failed", error);
    redirect(adminUrlWith("/admin/teams", { error: "failed" }));
  }
  redirect(adminUrlWith("/admin/teams", { notice: "team-deleted" }));
}
