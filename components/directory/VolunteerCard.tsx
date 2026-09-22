"use client";

import Link from "next/link";
import type { PublicVolunteer } from "@/lib/data/public";
import { VolunteerAvatar } from "@/components/volunteer/VolunteerAvatar";
import { TeamBadge } from "@/components/volunteer/TeamBadge";
import { LinkedInIcon } from "@/components/ui/LinkedInIcon";
import { accentVar, teamAccent } from "@/lib/utils/team-accent";

export function VolunteerCard({ volunteer, priority = false }: { volunteer: PublicVolunteer; priority?: boolean }) {
  const accent = teamAccent(volunteer.team?.slug);
  const linkedin = volunteer.socialLinks.linkedin;

  return (
    <li>
      <Link
        href={`/volunteer/${volunteer.slug}`}
        style={{ ["--accent" as string]: accentVar(accent) }}
        className="group flex h-full flex-col rounded-[1.4rem] border border-line bg-coal p-2 transition-colors hover:[border-color:var(--accent)]"
      >
        <VolunteerAvatar
          slug={volunteer.slug}
          name={volunteer.fullName}
          hasPhoto={volunteer.hasPhoto}
          version={volunteer.updatedAt}
          accent={accent}
          priority={priority}
        />
        <div className="flex flex-1 flex-col gap-2 px-2 pb-2 pt-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg font-semibold leading-snug text-fog">{volunteer.fullName}</h3>
            {linkedin && (
              <button
                type="button"
                aria-label={`${volunteer.fullName}'s LinkedIn profile`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(linkedin, "_blank", "noopener,noreferrer");
                }}
                className="shrink-0 text-dim transition-colors hover:text-fog"
              >
                <LinkedInIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          {volunteer.publicRole && <p className="text-sm text-mist">{volunteer.publicRole}</p>}
          {volunteer.team && (
            <div className="mt-auto pt-1">
              <TeamBadge name={volunteer.team.name} slug={volunteer.team.slug} />
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
