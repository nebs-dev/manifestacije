import type { Metadata } from "next";
import type { Viewport } from "next";
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
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: "/apple-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#1a2238"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr" className="light bg-background">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
