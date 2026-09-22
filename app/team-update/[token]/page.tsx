import { createPublicClient } from "@/lib/supabase/public";
import { hashInviteToken, isPlausibleToken } from "@/lib/team-invites";
import { TeamUpdateForm } from "@/components/team/TeamUpdateForm";
import { submitTeamUpdate } from "./actions";

export const metadata = { title: "Update your profile", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

export default async function TeamUpdatePage({ params }: Props) {
  const { token } = await params;
  if (!isPlausibleToken(token)) return <ExpiredNotice />;

  const tokenHash = await hashInviteToken(token);
  const supabase = createPublicClient();

  const { data: check } = await supabase.rpc("check_team_invite", { p_token_hash: tokenHash, p_type: "update" }).single();
  if (!check || !(check as { ok: boolean }).ok) return <ExpiredNotice />;

  const { data: volunteer } = await supabase.rpc("get_invite_volunteer", { p_token_hash: tokenHash }).single();
  if (!volunteer) return <ExpiredNotice />;

  const v = volunteer as {
    id: string;
    full_name: string;
    public_role: string | null;
    bio: string | null;
    skills: string[];
    social_links: Record<string, { url: string; approved: boolean }>;
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
      <h1 className="text-3xl font-bold sm:text-4xl">Update your profile</h1>
      <p className="mt-2 text-mist">Changes are reviewed by an administrator before they go live.</p>
      <div className="mt-8">
        <TeamUpdateForm
          action={submitTeamUpdate.bind(null, token)}
          initial={{
            fullName: v.full_name,
            publicRole: v.public_role,
            bio: v.bio,
            skills: v.skills ?? [],
            socialLinks: v.social_links ?? {},
          }}
        />
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
