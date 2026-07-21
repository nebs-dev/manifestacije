import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/public/site-header"
import { SiteFooter } from "@/components/public/site-footer"
import { ResultsGrid } from "@/components/public/results-grid"
import { SeoLinkBlock } from "@/components/public/seo-link-block"
import { fetchCategories, fetchEvents, WEB_URL } from "@/lib/public-api"
import { breadcrumbsToJsonLd, eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld"
import {
  categoryLinksForEvents,
  categoryName,
  cityLocationPhrase,
  cityName,
} from "@/lib/seo-taxonomy"

type PageProps = {
  params: { citySlug: string; categorySlug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [events, categories] = await Promise.all([
    fetchEvents({ city: params.citySlug, category: params.categorySlug }),
    fetchCategories(),
  ])
  const city = cityName(params.citySlug, events)
  const location = cityLocationPhrase(params.citySlug, city)
  const category = categoryName(params.categorySlug, categories, events)
  const title = `${category} ${city}`
  const description = `Pregled aktualnih događanja, manifestacija i evenata za ${category.toLowerCase()} u ${location}. Pronađi termine, lokacije i programe.`
  const url = `${WEB_URL}/gradovi/${params.citySlug}/kategorije/${params.categorySlug}`

  return {
    title,
    description,
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary", title, description },
    alternates: { canonical: url },
    ...(events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function CityCategoryPage({ params }: PageProps) {
  const [events, categories] = await Promise.all([
    fetchEvents({ city: params.citySlug, category: params.categorySlug }),
    fetchCategories(),
  ])
  const city = cityName(params.citySlug, events)
  const location = cityLocationPhrase(params.citySlug, city)
  const category = categoryName(params.categorySlug, categories, events)
  const siblingLinks = categoryLinksForEvents(
    events,
    categories,
    (categorySlug) => `/gradovi/${params.citySlug}/kategorije/${categorySlug}`,
    params.categorySlug,
  )
  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    [
      { name: "Početna", path: "/" },
      { name: "Gradovi", path: "/gradovi" },
      { name: city, path: `/gradovi/${params.citySlug}` },
      { name: category, path: `/gradovi/${params.citySlug}/kategorije/${params.categorySlug}` },
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
        <Link href={`/gradovi/${params.citySlug}`} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Događanja {city}
        </Link>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Grad · Kategorija</p>
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
