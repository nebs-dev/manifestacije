import type { Metadata } from "next"
import { WeekendLanding } from "@/components/public/weekend-landing"
import { fetchEvents, fetchWeekendScopes } from "@/lib/public-api"
import { kamoZaVikendSeo } from "@/lib/weekend-seo"
import { weekendEmptyState } from "@/lib/weekend-nearby"
import { DEFAULT_OG_IMAGE } from "@/lib/seo-images"

type PageProps = { params: { citySlug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [events, scopes] = await Promise.all([
    fetchEvents({ when: "ovaj-vikend", city: params.citySlug }, { revalidate: WEEKEND_PAGE_REVALIDATE }),
    fetchWeekendScopes(),
  ])
  const seo = kamoZaVikendSeo({ kind: "city", slug: params.citySlug, events })
  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical: seo.canonical },
    // A place that has had events recently keeps the page indexable through a
    // quiet weekend (SEO-15); only places with no programme at all drop out.
    robots: events.length > 0 || scopes.cities.includes(params.citySlug) ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

const WEEKEND_PAGE_REVALIDATE = 900;

// Cached for 15 minutes instead of rendered per request (PERF-01): these pages
// answered in ~4-6s on every visit. Nothing is prerendered at build time, so
// the first visit to a slug renders it and later visits are served from the
// cache; `events` tag invalidation still refreshes them on data changes, and
// the weekend labels can lag by at most one interval after the Monday switch.
export const revalidate = WEEKEND_PAGE_REVALIDATE;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [] as { citySlug: string }[];
}

export default async function KamoZaVikendCityPage({ params }: PageProps) {
  const events = await fetchEvents({ when: "ovaj-vikend", city: params.citySlug }, { revalidate: WEEKEND_PAGE_REVALIDATE })
  const seo = kamoZaVikendSeo({ kind: "city", slug: params.citySlug, events })
  const emptyState = events.length === 0
    ? await weekendEmptyState({ kind: "city", slug: params.citySlug, name: seo.breadcrumbName })
    : undefined
  return (
    <WeekendLanding
      events={events}
      emptyState={emptyState}
      eyebrow={seo.eyebrow}
      h1={seo.h1}
      intro={seo.description}
      breadcrumbs={[
        { name: "Početna", path: "/" },
        { name: "Kamo za vikend", path: "/kamo-za-vikend" },
        { name: seo.breadcrumbName, path: `/kamo-za-vikend/gradovi/${params.citySlug}` },
      ]}
    />
  )
}
