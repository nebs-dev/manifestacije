import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manifestacije - Što se događa u Hrvatskoj",
  description: "Manifestacije, koncerti, radionice, obiteljski programi i lokalni događaji po regijama, datumu i karti",
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
