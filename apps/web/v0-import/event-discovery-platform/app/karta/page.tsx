import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { DiscoveryExplorer } from "@/components/discovery-explorer"
import { events } from "@/lib/data"

export const metadata: Metadata = {
  title: "Karta događanja",
  description: "Istraži sva događanja diljem Hrvatske na interaktivnoj karti.",
}

export default function MapPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <DiscoveryExplorer events={events} />
      </main>
    </>
  )
}
