import { getAdminSession } from "@/lib/auth/admin";
import { QR_FILENAME_BASE, qrPngBuffer, qrSvgString } from "@/lib/qr";
import { getSiteUrlStatus } from "@/lib/site-url";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Admin-only download of the master QR code as SVG or PNG. */
export async function GET(_request: Request, context: { params: Promise<{ format: string }> }) {
  const session = await getAdminSession();
  if (session.status === "anonymous" || session.status === "unconfigured") {
    return new Response("Sign in required", { status: 401, headers: NO_STORE });
  }
  if (session.status !== "admin") {
    return new Response("Forbidden", { status: 403, headers: NO_STORE });
  }

  const { format } = await context.params;
  const site = getSiteUrlStatus();
  if (!site.url) {
    return new Response(site.error ?? "NEXT_PUBLIC_SITE_URL is not configured", { status: 409, headers: NO_STORE });
  }

  if (format === "svg") {
    return new Response(await qrSvgString(site.url), {
      headers: {
        ...NO_STORE,
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${QR_FILENAME_BASE}.svg"`,
      },
    });
  }
  if (format === "png") {
    const png = await qrPngBuffer(site.url);
    return new Response(new Uint8Array(png), {
      headers: {
        ...NO_STORE,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${QR_FILENAME_BASE}.png"`,
      },
    });
  }
  return new Response("Unknown format. Use svg or png.", { status: 404, headers: NO_STORE });
}
