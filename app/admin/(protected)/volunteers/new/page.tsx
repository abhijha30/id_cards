import Link from "next/link";
import { VolunteerForm } from "@/components/admin/VolunteerForm";
import { requireAdmin } from "@/lib/auth/admin";
import { listTeamOptions } from "@/lib/data/admin";
import { createVolunteer } from "../actions";

export const metadata = { title: "Add a volunteer" };

export default async function NewVolunteerPage() {
  const { supabase } = await requireAdmin();
  const teams = await listTeamOptions(supabase);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/volunteers" className="btn btn-quiet btn-sm -ml-3 mb-4">
        All volunteers
      </Link>
      <h1 className="text-3xl font-bold sm:text-4xl">Add a volunteer</h1>
      <p className="mb-8 mt-2 text-mist">Save the details first. You can add the photo on the next screen.</p>
      <VolunteerForm mode="create" action={createVolunteer} teams={teams} />
    </div>
  );
}
