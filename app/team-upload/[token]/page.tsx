import { createPublicClient } from "@/lib/supabase/public";
import { hashInviteToken, isPlausibleToken } from "@/lib/team-invites";
import { listPublicTeams } from "@/lib/data/public";
import { TeamUploadForm } from "@/components/team/TeamUploadForm";
import { submitTeamUpload } from "./actions";

export const metadata = { title: "Volunteer sign-up", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

export default async function TeamUploadPage({ params }: Props) {
  const { token } = await params;
  if (!isPlausibleToken(token)) return <ExpiredNotice />;

  const tokenHash = await hashInviteToken(token);
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("check_team_invite", { p_token_hash: tokenHash, p_type: "upload" }).single();

  if (error || !data || !(data as { ok: boolean }).ok) return <ExpiredNotice />;

  const teams = await listPublicTeams().catch(() => []);

  return (
    <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
      <h1 className="text-3xl font-bold sm:text-4xl">Add your profile</h1>
      <p className="mt-2 text-mist">Fill this in and submit. An administrator will review it before it appears anywhere.</p>
      <div className="mt-8">
        <TeamUploadForm action={submitTeamUpload.bind(null, token)} teams={teams} />
      </div>
    </main>
  );
}

function ExpiredNotice() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
      <h1 className="text-2xl font-semibold">This link has expired or has already been used.</h1>
      <p className="mt-2 text-mist">Please contact the administrator for a new link.</p>
    </main>
  );
}
