import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { DiscoveryExplorer } from "@/components/public/discovery-explorer";
import { fetchMapEvents } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Karta događanja",
  description: "Istraži događanja na interaktivnoj karti Hrvatske.",
};

export default async function MapPage() {
  const events = await fetchMapEvents();
  return (
    <>
      <SiteHeader />
      <main>
        <DiscoveryExplorer events={events} />
      </main>
    </>
  );
}
