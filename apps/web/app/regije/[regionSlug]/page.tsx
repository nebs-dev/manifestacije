import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { SeoLinkBlock } from "@/components/public/seo-link-block";
import { fetchCategories, fetchEvents, fetchRegions, WEB_URL } from "@/lib/public-api";
import { breadcrumbsToJsonLd, eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld";
import { categoryLinksForEvents, cityLinksForEvents, regionImage, regionLocationPhrase, regionName } from "@/lib/seo-taxonomy";

export async function generateMetadata({ params }: { params: { regionSlug: string } }): Promise<Metadata> {
  const [events, regions] = await Promise.all([
    fetchEvents({ region: params.regionSlug }),
    fetchRegions(),
  ]);
  const name = regionName(params.regionSlug, regions);
  const location = regionLocationPhrase(params.regionSlug, name);
  const title = `Digitalni kalendar događanja u ${location}`;
  const description = `Digitalni kalendar događanja za ${location}: koncerti, festivali, manifestacije i eventi. Pronađi aktualne termine, lokacije i programe.`;
  return {
    title,
    description,
    openGraph: { type: "website", title, description, url: `${WEB_URL}/regije/${params.regionSlug}` },
    twitter: { card: "summary", title, description },
    alternates: { canonical: `${WEB_URL}/regije/${params.regionSlug}` },
    ...(events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function RegionPage({ params }: { params: { regionSlug: string } }) {
  const [events, categories, regions] = await Promise.all([
    fetchEvents({ region: params.regionSlug }),
    fetchCategories(),
    fetchRegions(),
  ]);
  const name = regionName(params.regionSlug, regions);
  const location = regionLocationPhrase(params.regionSlug, name);
  const image = regionImage(params.regionSlug);
  const categoryLinks = categoryLinksForEvents(
    events,
    categories,
    (categorySlug) => `/regije/${params.regionSlug}/kategorije/${categorySlug}`,
  );
  const cityLinks = cityLinksForEvents(events, (citySlug) => `/gradovi/${citySlug}`);
  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    [
      { name: "Početna", path: "/" },
      { name: "Regije", path: "/regije" },
      { name, path: `/regije/${params.regionSlug}` },
    ],
    WEB_URL,
  );
  return (
    <>
      <SiteHeader />
      {events.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(eventsToItemListJsonLd(events, WEB_URL)) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
      <main>
        <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
          <div className="absolute inset-0 opacity-45">
            {image ? <Image src={image} alt="" fill className="object-cover" sizes="100vw" /> : null}
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/20" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
            <Link href="/regije" className="inline-flex items-center gap-1.5 rounded-full bg-ink-foreground/10 px-3 py-1.5 text-sm hover:bg-ink-foreground/15">
              <ArrowLeft className="size-4" /> Regije
            </Link>
            <h1 className="mt-6 max-w-2xl font-heading text-4xl font-semibold md:text-6xl">Digitalni kalendar događanja u {location}</h1>
            <p className="mt-4 max-w-2xl text-pretty text-ink-foreground/80">
              Manifestacije, eventi i događaji u {location}.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="mb-6 text-muted-foreground">{events.length} događanja</p>
          <SeoLinkBlock title={`Gradovi u ${location}`} links={cityLinks} />
          <SeoLinkBlock title={`Popularno u ${location}`} links={categoryLinks} />
          <ResultsGrid events={events} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
