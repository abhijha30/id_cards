import { SOCIAL_PLATFORMS, type PublicSocialLinks } from "@/lib/social";
import { displayUrl } from "@/lib/utils/safe-url";

/** Renders only links that arrived from the approved-only public view. */
export function SocialLinks({ links }: { links: PublicSocialLinks }) {
  const items = SOCIAL_PLATFORMS.flatMap((p) => {
    const url = links[p.key];
    return url ? [{ key: p.key, label: p.label, url }] : [];
  });
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-3">
      {items.map((item) => (
        <li key={item.key}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="block rounded-2xl border border-line-strong bg-coal px-4 py-3 transition-colors hover:border-mist"
          >
            <span className="block font-semibold text-fog">
              {item.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
            <span className="block text-sm text-dim">{displayUrl(item.url)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
