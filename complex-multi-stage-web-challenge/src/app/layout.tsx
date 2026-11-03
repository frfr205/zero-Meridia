import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CaseProvider } from "@/components/case-provider";
import { SiteChrome } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Zero Meridian — a multi-stage investigation",
  description: "Seven linked acts across four nodes: archival checksums, ciphers, a radio signal, a lunar atlas and a routing puzzle. One investigation, solved on the server.",
};

export const viewport: Viewport = {
  themeColor: "#090b0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CaseProvider><SiteChrome>{children}</SiteChrome></CaseProvider>
      </body>
    </html>
  );
}
