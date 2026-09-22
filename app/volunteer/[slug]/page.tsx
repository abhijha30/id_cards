import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/ui/PublicShell";
import { VolunteerAvatar } from "@/components/volunteer/VolunteerAvatar";
import { TeamBadge } from "@/components/volunteer/TeamBadge";
import { SocialLinks } from "@/components/volunteer/SocialLinks";
import { ShareProfile } from "@/components/volunteer/ShareProfile";
import { ORG_NAME, SEARCH_ENGINE_INDEXING } from "@/lib/config";
import { getPublicVolunteerBySlug } from "@/lib/data/public";
import { teamAccent } from "@/lib/utils/team-accent";
import { LinkedInIcon } from "@/components/ui/LinkedInIcon";

type Props = { params: Promise<{ slug: string }> };

// One lookup per request, shared by the page and its metadata.
const loadVolunteer = cache(getPublicVolunteerBySlug);

function describe(role: string | null, team: string | null, bio: string | null): string {
  if (bio) return bio.length > 155 ? `${bio.slice(0, 154).trimEnd()}…` : bio;
  const parts = [role, team ? `${team} team` : null].filter(Boolean).join(", ");
  return parts ? `${parts} at ${ORG_NAME}.` : `${ORG_NAME} volunteer.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const volunteer = await loadVolunteer(slug).catch(() => null);

  // Unpublished, unconsented and unknown profiles all look identical: nothing is disclosed.
  if (!volunteer) return { title: "Profile not available", robots: { index: false, follow: false } };

  const description = describe(volunteer.publicRole, volunteer.team?.name ?? null, volunteer.bio);
  const image = volunteer.hasPhoto ? [{ url: `/photos/${volunteer.slug}?v=${encodeURIComponent(volunteer.updatedAt)}`, alt: volunteer.fullName }] : undefined;

  return {
    title: volunteer.fullName,
    description,
    robots: SEARCH_ENGINE_INDEXING ? undefined : { index: false, follow: false },
    openGraph: { title: `${volunteer.fullName} | ${ORG_NAME}`, description, type: "profile", images: image },
    twitter: { card: image ? "summary_large_image" : "summary", title: `${volunteer.fullName} | ${ORG_NAME}`, description },
  };
}

export default async function VolunteerPage({ params }: Props) {
  const { slug } = await params;
  const volunteer = await loadVolunteer(slug);
  if (!volunteer) notFound();

  const accent = teamAccent(volunteer.team?.slug);

  return (
    <PublicShell>
      <Link href="/" className="btn btn-quiet btn-sm -ml-3 mb-6">
        All volunteers
      </Link>

      <article className="grid gap-10 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-14">
        <div className="mx-auto w-full max-w-xs md:mx-0 md:max-w-none">
          <div className="rounded-[1.4rem] border border-line bg-coal p-2">
            <VolunteerAvatar
              slug={volunteer.slug}
              name={volunteer.fullName}
              hasPhoto={volunteer.hasPhoto}
              version={volunteer.updatedAt}
              accent={accent}
              priority
            />
          </div>
        </div>

        <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-4xl font-bold sm:text-5xl">{volunteer.fullName}</h1>
            {volunteer.socialLinks.linkedin && (
              
                href={volunteer.socialLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                aria-label={`${volunteer.fullName}'s LinkedIn profile`}
                className="text-dim transition-colors hover:text-fog"
              >
                <LinkedInIcon className="h-5 w-5" />
              </a>
            )}
          </div>
          {volunteer.publicRole && <p className="mt-3 text-xl text-mist">{volunteer.publicRole}</p>}
          {volunteer.team && (
            <div className="mt-4">
              <TeamBadge name={volunteer.team.name} slug={volunteer.team.slug} />
            </div>
          )}

          {volunteer.bio && (
            <section aria-labelledby="about-heading" className="mt-8">
              <h2 id="about-heading" className="mb-2 text-lg font-semibold">
                About
              </h2>
              <p className="whitespace-pre-line text-lg leading-relaxed text-fog/90">{volunteer.bio}</p>
            </section>
          )}

          {volunteer.skills.length > 0 && (
            <section aria-labelledby="skills-heading" className="mt-8">
              <h2 id="skills-heading" className="mb-3 text-lg font-semibold">
                Skills
              </h2>
              <ul className="flex flex-wrap gap-2">
                {volunteer.skills.map((skill) => (
                  <li key={skill} className="rounded-full border border-line-strong px-3 py-1 text-sm text-mist">
                    {skill}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {Object.keys(volunteer.socialLinks).length > 0 && (
            <section aria-labelledby="links-heading" className="mt-8">
              <h2 id="links-heading" className="mb-3 text-lg font-semibold">
                Links
              </h2>
              <SocialLinks links={volunteer.socialLinks} />
            </section>
          )}

          <div className="mt-10 border-t border-line pt-6">
            <ShareProfile name={volunteer.fullName} />
            <p className="mt-5 text-sm text-dim">
              Listed with the volunteer&rsquo;s consent. To correct or remove a profile, see the{" "}
              <Link href="/privacy" className="text-mist underline underline-offset-4">
                privacy page
              </Link>
              .
            </p>
          </div>
        </div>
      </article>
    </PublicShell>
  );
}
