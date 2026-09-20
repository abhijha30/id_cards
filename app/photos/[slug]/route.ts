import { PHOTO_BUCKET } from "@/lib/config";
import { getPublicPhotoPath } from "@/lib/data/public";
import { createPublicClient } from "@/lib/supabase/public";
import { isPhotoMime } from "@/lib/validation/photo";

/**
 * Serves a volunteer's photo from the PRIVATE bucket, as the anonymous role. Storage RLS only
 * lets `anon` read a photo while the volunteer is published with consent granted, so an
 * unpublished profile's photo cannot be fetched through this route (or any other).
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  const notFound = () =>
    new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });

  let path: string | null;
  try {
    path = await getPublicPhotoPath(slug);
  } catch (error) {
    console.error("photo lookup failed", error);
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!path) return notFound();

  const { data, error } = await createPublicClient().storage.from(PHOTO_BUCKET).download(path);
  if (error || !data) return notFound();
  if (!isPhotoMime(data.type)) return notFound();

  return new Response(data, {
    headers: {
      "Content-Type": data.type,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // Short cache: an unpublished profile's photo stops being served within minutes.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
