import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { fetchEvents, WEB_URL } from "@/lib/public-api";
import { eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld";

function humanizeCitySlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const events = await fetchEvents({ city: params.citySlug });
  const cityName = events[0]?.city || humanizeCitySlug(params.citySlug);
  const title = `Događanja u gradu ${cityName}`;
  const description = `Pregled svih događanja u gradu ${cityName}.`;
  return {
    title,
    description,
    openGraph: { type: "website", title, description, url: `${WEB_URL}/gradovi/${params.citySlug}` },
    twitter: { card: "summary", title, description },
    alternates: { canonical: `${WEB_URL}/gradovi/${params.citySlug}` },
    // Thin/empty listing pages hurt SEO if indexed — keep them out of the index
    // until they have events, but still let crawlers follow links through them.
    ...(events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CityPage({ params }: { params: { citySlug: string } }) {
  const events = await fetchEvents({ city: params.citySlug });
  const cityName = events[0]?.city || humanizeCitySlug(params.citySlug);
  return (
    <>
      <SiteHeader />
      {events.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(eventsToItemListJsonLd(events, WEB_URL)) }} />
      )}
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Grad</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">{cityName}</h1>
        <p className="mb-8 mt-2 text-muted-foreground">{events.length} dogadanja</p>
        <ResultsGrid events={events} />
      </main>
      <SiteFooter />
    </>
  );
}
