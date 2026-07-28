import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { SeoLinkBlock } from "@/components/public/seo-link-block";
import { fetchCategories, fetchEvents, WEB_URL } from "@/lib/public-api";
import { breadcrumbsToJsonLd, eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld";
import { categoryLinksForEvents, citySeoFields } from "@/lib/seo-taxonomy";

export async function generateMetadata({ params }: { params: { citySlug: string } }): Promise<Metadata> {
  const events = await fetchEvents({ city: params.citySlug });
  const { title, description, canonical } = citySeoFields(params.citySlug, events, WEB_URL);
  return {
    title: { absolute: title },
    description,
    openGraph: { type: "website", title, description, url: canonical },
    twitter: { card: "summary", title, description },
    alternates: { canonical },
    // Thin/empty listing pages hurt SEO if indexed — keep them out of the index
    // until they have events, but still let crawlers follow links through them.
    ...(events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CityPage({ params }: { params: { citySlug: string } }) {
  const [events, categories] = await Promise.all([
    fetchEvents({ city: params.citySlug }),
    fetchCategories(),
  ]);
  const { name, location } = citySeoFields(params.citySlug, events, WEB_URL);
  const categoryLinks = categoryLinksForEvents(
    events,
    categories,
    (categorySlug) => `/gradovi/${params.citySlug}/kategorije/${categorySlug}`,
  );
  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    [
      { name: "Početna", path: "/" },
      { name: "Gradovi", path: "/gradovi" },
      { name, path: `/gradovi/${params.citySlug}` },
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
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link href="/gradovi" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Svi gradovi
        </Link>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Grad</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Događanja u {location}</h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          Digitalni kalendar događanja za {location} — {events.length} događanja, manifestacija i evenata
        </p>
        <SeoLinkBlock title={`Popularno u ${location}`} links={categoryLinks} />
        <ResultsGrid events={events} />
      </main>
      <SiteFooter />
    </>
  );
}
