import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CommandPaletteProvider } from "@/components/CommandPalette";
import { BackgroundFx } from "@/components/BackgroundFx";
import { profile } from "@/data/profile";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://narendra.dev";
const description =
  "Narendra Nalam — Backend software engineer at Kore.AI. Full-stack portfolio of distributed systems: job queues, API gateways, observability, feature flags, workflow builder, developer portal.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${profile.name} — ${profile.role}`,
    template: `%s · ${profile.name}`,
  },
  description,
  openGraph: {
    type: "website",
    siteName: profile.name,
    title: `${profile.name} — ${profile.role}`,
    description,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${profile.name} — ${profile.role}`,
    description,
  },
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 text-slate-200 antialiased font-sans selection:bg-cyan-400/20">
        <BackgroundFx />
        <CommandPaletteProvider>
          <Nav />
          <main className="relative z-10">{children}</main>
          <Footer />
        </CommandPaletteProvider>
      </body>
    </html>
  );
}
