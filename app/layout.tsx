import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { APP_NAME, ORG_NAME, SEARCH_ENGINE_INDEXING } from "@/lib/config";
import { getMetadataBase } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: { default: APP_NAME, template: `%s | ${ORG_NAME} Volunteers` },
  description: `Find and confirm ${ORG_NAME} volunteers. Search by name to check who you are talking to.`,
  applicationName: APP_NAME,
  robots: SEARCH_ENGINE_INDEXING ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
