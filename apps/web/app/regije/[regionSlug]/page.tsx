import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { getRegion } from "@/lib/data";
import { fetchEvents } from "@/lib/public-api";

export default async function RegionPage({ params }: { params: { regionSlug: string } }) {
  const region = getRegion(params.regionSlug);
  const events = await fetchEvents({ region: params.regionSlug });
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
          <div className="absolute inset-0 opacity-45">
            {region?.image ? <Image src={region.image} alt="" fill className="object-cover" sizes="100vw" /> : null}
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/20" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
            <Link href="/regije" className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/10 px-3 py-1.5 text-sm hover:bg-ink-foreground/15">
              <ArrowLeft className="size-4" /> Regije
            </Link>
            <h1 className="mt-6 max-w-2xl font-heading text-4xl font-semibold md:text-6xl">{region?.name || params.regionSlug}</h1>
            <p className="mt-4 max-w-2xl text-pretty text-ink-foreground/80">{region?.blurb || "Dogadanja u odabranoj regiji."}</p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="mb-6 text-muted-foreground">{events.length} dogadanja</p>
          <ResultsGrid events={events} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
