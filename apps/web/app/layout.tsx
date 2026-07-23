import type { Metadata } from "next";
import type { Viewport } from "next";
import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { RouteProgress } from "@/components/route-progress";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_WEB_URL || "https://manifestacije.hr"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Manifestacije — Što se događa oko tebe?",
    template: "%s | Manifestacije",
  },
  description: "Pronađi mjesto, manifestaciju ili dobar razlog da ne ostaneš doma.",
  openGraph: {
    type: "website",
    locale: "hr_HR",
    url: siteUrl,
    siteName: "Manifestacije",
    title: "Manifestacije — Što se događa oko tebe?",
    description: "Pronađi mjesto, manifestaciju ili dobar razlog da ne ostaneš doma.",
    images: [{ url: "/logo/logo.svg", width: 1024, height: 1024, alt: "Manifestacije" }],
  },
  twitter: {
    card: "summary",
    title: "Manifestacije — Što se događa oko tebe?",
    description: "Pronađi mjesto, manifestaciju ili dobar razlog da ne ostaneš doma.",
    images: ["/logo/logo.svg"],
  },
  icons: {
    // PNG/ICO first for guaranteed browser and Search Console compatibility;
    // SVG last as a progressive-enhancement fallback for browsers that prefer it.
    icon: [
      { url: "/brand/favicon-v2.ico", sizes: "any" },
      { url: "/brand/icon-16x16-v2.png", type: "image/png", sizes: "16x16" },
      { url: "/brand/icon-32x32-v2.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/icon-48x48-v2.png", type: "image/png", sizes: "48x48" },
      { url: "/brand/icon-192x192-v2.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/icon-512x512-v2.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/brand/favicon-v2.ico",
    apple: "/brand/apple-icon-v2.png",
  },
  manifest: "/manifest.webmanifest",
  // No verification meta tag needed — ownership is verified via a DNS TXT
  // record on the domain property, not the HTML-tag method.
};

export const viewport: Viewport = {
  themeColor: "#1a2238"
};

const gaId = process.env.NEXT_PUBLIC_GA_ID
const apiUrl = process.env.NEXT_PUBLIC_API_URL

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr" className="light bg-background">
      <head>
        {apiUrl && <link rel="preconnect" href={apiUrl} />}
        <link rel="preconnect" href="https://res.cloudinary.com" />
      </head>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
