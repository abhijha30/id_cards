import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/ui/PublicShell";
import { CONSENT_VERSION, CONTACT_EMAIL, ORG_NAME, SEARCH_ENGINE_INDEXING } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy and removal requests",
  description: `How the ${ORG_NAME} volunteer directory handles volunteers' information.`,
};

const isDraft = CONSENT_VERSION.toLowerCase().includes("draft");

export default function PrivacyPage() {
  return (
    <PublicShell>
      <article className="max-w-2xl">
        <h1 className="text-4xl font-bold sm:text-5xl">Privacy and removal requests</h1>

        {isDraft && (
          <p role="note" className="mt-6 rounded-2xl border border-g-yellow/50 bg-g-yellow/10 px-4 py-3 text-sm text-fog">
            Draft for review. The {ORG_NAME} organisers should check this wording, and have it reviewed against the
            data-protection rules that apply to them, before the directory goes live. Once approved, change
            CONSENT_VERSION in lib/config.ts so this notice disappears.
          </p>
        )}

        <div className="mt-8 space-y-9 text-lg leading-relaxed text-fog/90">
          <section aria-labelledby="what">
            <h2 id="what" className="mb-2 text-2xl font-semibold text-fog">
              What this directory is
            </h2>
            <p>
              Every {ORG_NAME} volunteer ID card carries the same QR code. It opens this directory so that anyone can check
              that a person really is a listed volunteer.
            </p>
          </section>

          <section aria-labelledby="shown">
            <h2 id="shown" className="mb-2 text-2xl font-semibold text-fog">
              What is shown about a volunteer
            </h2>
            <p>
              Only what the volunteer agreed to: name, photo, team, role, a short bio, skills, and any social links they
              approved individually. Nothing else is stored in the directory. There is no email address, phone number,
              date of birth, address or ID number.
            </p>
          </section>

          <section aria-labelledby="consent">
            <h2 id="consent" className="mb-2 text-2xl font-semibold text-fog">
              Consent comes first
            </h2>
            <p>
              A profile is public only after the volunteer&rsquo;s consent has been recorded, and it disappears from the
              directory as soon as consent is withdrawn. Photos are kept in private storage and are served only for
              profiles that are currently public.
            </p>
          </section>

          <section aria-labelledby="visitors">
            <h2 id="visitors" className="mb-2 text-2xl font-semibold text-fog">
              What happens when you visit
            </h2>
            <p>
              The public pages do not use cookies, accounts or analytics. As with any website, our hosting providers
              (Vercel for the site and Supabase for the data) process standard technical records such as IP addresses in
              their server logs.
              {SEARCH_ENGINE_INDEXING
                ? " Profiles may appear in search engine results."
                : " Profiles are marked so that search engines are asked not to list them."}
            </p>
          </section>

          <section aria-labelledby="requests">
            <h2 id="requests" className="mb-2 text-2xl font-semibold text-fog">
              Correct or remove a profile
            </h2>
            <p>
              Volunteers can ask at any time for their profile to be corrected, hidden or deleted, and can withdraw consent
              without giving a reason.{" "}
              {CONTACT_EMAIL ? (
                <>
                  Write to{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-g-blue underline underline-offset-4">
                    {CONTACT_EMAIL}
                  </a>
                  .
                </>
              ) : (
                <>Speak to a {ORG_NAME} organiser. (A contact address has not been configured yet.)</>
              )}
            </p>
          </section>
        </div>

        <Link href="/" className="btn mt-10">
          Back to the directory
        </Link>
      </article>
    </PublicShell>
  );
}
