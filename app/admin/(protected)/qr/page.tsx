import { PrintButton } from "@/components/qr/PrintButton";
import { requireAdmin } from "@/lib/auth/admin";
import { qrSvgString } from "@/lib/qr";
import { getSiteUrlStatus } from "@/lib/site-url";

export const metadata = { title: "Master QR code" };

export default async function QrPage() {
  await requireAdmin();
  const site = getSiteUrlStatus();

  const svg = site.url ? await qrSvgString(site.url) : null;
  const previewSrc = svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` : null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold sm:text-4xl">Master QR code</h1>
      <p className="mb-8 mt-2 max-w-2xl text-mist no-print">
        One code for every ID card. It opens the public directory, where people search for the volunteer they are talking to. There are
        no per-volunteer codes.
      </p>

      {site.error && (
        <div role="alert" className="no-print mb-8 rounded-2xl border border-danger/50 bg-danger/10 p-5">
          <h2 className="text-lg font-semibold text-danger">The QR code cannot be created yet</h2>
          <p className="mt-1 text-sm">{site.error}</p>
          <p className="mt-2 text-sm text-mist">
            Set <code>NEXT_PUBLIC_SITE_URL</code> in your environment (Vercel: Project Settings, Environment Variables) and redeploy.
          </p>
        </div>
      )}

      {site.warnings.map((warning) => (
        <div key={warning} role="alert" className="no-print mb-8 rounded-2xl border border-g-yellow/50 bg-g-yellow/10 p-5">
          <h2 className="text-lg font-semibold">Do not print ID cards yet</h2>
          <p className="mt-1 text-sm text-fog/90">{warning}</p>
        </div>
      ))}

      {site.url && previewSrc && (
        <div className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="print-sheet panel p-5">
            <div className="rounded-2xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc} alt={`QR code that opens ${site.url}`} className="h-auto w-full" width={352} height={352} />
            </div>
            <p className="mt-4 break-all text-center text-sm text-mist print:text-black">{site.url}</p>
          </div>

          <div className="no-print space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Encoded address</h2>
              <p className="mt-1 break-all rounded-xl border border-line-strong bg-coal-2 px-4 py-3 font-mono text-sm">{site.url}</p>
              <p className="mt-2 text-sm text-dim">
                The code contains exactly this address and nothing else. Scan it with a phone before you send cards to print.
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold">Download</h2>
              <div className="flex flex-wrap gap-3">
                <a href="/api/admin/qr/svg" download className="btn btn-primary">
                  Download SVG (best for print)
                </a>
                <a href="/api/admin/qr/png" download className="btn">
                  Download PNG
                </a>
                <PrintButton />
              </div>
            </div>

            <div className="text-sm text-mist">
              <h2 className="mb-2 text-lg font-semibold text-fog">Printing tips</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Use the SVG for print shops: it stays sharp at any size.</li>
                <li>Print at least 2 cm (0.8 in) wide, black on white, with the white margin left intact.</li>
                <li>Avoid glossy lamination directly over the code, which can cause glare when scanning.</li>
                <li>Test one printed card with two different phones before printing the full batch.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
