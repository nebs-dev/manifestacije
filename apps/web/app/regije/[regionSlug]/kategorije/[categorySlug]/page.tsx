import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/public/site-header"
import { SiteFooter } from "@/components/public/site-footer"
import { ResultsGrid } from "@/components/public/results-grid"
import { SeoLinkBlock } from "@/components/public/seo-link-block"
import { fetchCategories, fetchEvents, fetchRegions, WEB_URL } from "@/lib/public-api"
import { breadcrumbsToJsonLd, eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld"
import {
  categoryLinksForEvents,
  categoryName,
  regionLocationPhrase,
  regionName,
} from "@/lib/seo-taxonomy"

type PageProps = {
  params: { regionSlug: string; categorySlug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [events, categories, regions] = await Promise.all([
    fetchEvents({ region: params.regionSlug, category: params.categorySlug }),
    fetchCategories(),
    fetchRegions(),
  ])
  const region = regionName(params.regionSlug, regions)
  const location = regionLocationPhrase(params.regionSlug, region)
  const category = categoryName(params.categorySlug, categories, events)
  const title = `${category} u regiji ${region}`
  const description = `Pregled aktualnih događanja, manifestacija i evenata za ${category.toLowerCase()} u ${location}. Pronađi termine, lokacije i programe.`
  const url = `${WEB_URL}/regije/${params.regionSlug}/kategorije/${params.categorySlug}`

  return {
    title,
    description,
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary", title, description },
    alternates: { canonical: url },
    ...(events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function RegionCategoryPage({ params }: PageProps) {
  const [events, categories, regions] = await Promise.all([
    fetchEvents({ region: params.regionSlug, category: params.categorySlug }),
    fetchCategories(),
    fetchRegions(),
  ])
  const region = regionName(params.regionSlug, regions)
  const location = regionLocationPhrase(params.regionSlug, region)
  const category = categoryName(params.categorySlug, categories, events)
  const siblingLinks = categoryLinksForEvents(
    events,
    categories,
    (categorySlug) => `/regije/${params.regionSlug}/kategorije/${categorySlug}`,
    params.categorySlug,
  )
  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    [
      { name: "Početna", path: "/" },
      { name: "Regije", path: "/regije" },
      { name: region, path: `/regije/${params.regionSlug}` },
      { name: category, path: `/regije/${params.regionSlug}/kategorije/${params.categorySlug}` },
    ],
    WEB_URL,
  )

  return (
    <>
      <SiteHeader />
      {events.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(eventsToItemListJsonLd(events, WEB_URL)) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link href={`/regije/${params.regionSlug}`} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Događanja {region}
        </Link>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Regija · Kategorija</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">{category} u {location}</h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          {events.length} događanja, manifestacija i evenata
        </p>
        <SeoLinkBlock title={`Još popularnih kategorija u ${location}`} links={siblingLinks} />
        <ResultsGrid events={events} />
      </main>
      <SiteFooter />
    </>
  )
}
