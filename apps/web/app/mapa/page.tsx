import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { DiscoveryExplorer } from "@/components/public/discovery-explorer";
import { fetchMapEvents, WEB_URL } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Karta događanja",
  description: "Istraži događanja na interaktivnoj karti Hrvatske.",
  alternates: { canonical: `${WEB_URL}/mapa` },
};

export default async function MapPage() {
  const events = await fetchMapEvents();
  return (
    <>
      <SiteHeader />
      <main>
        <h1 className="sr-only">Karta događanja</h1>
        <DiscoveryExplorer events={events} />
      </main>
    </>
  );
}
