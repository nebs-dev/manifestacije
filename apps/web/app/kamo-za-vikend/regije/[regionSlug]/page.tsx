import type { Metadata } from "next"
import { WeekendLanding } from "@/components/public/weekend-landing"
import { fetchEvents, fetchRegions, fetchWeekendScopes } from "@/lib/public-api"
import { kamoZaVikendSeo } from "@/lib/weekend-seo"
import { canonicalRegionSlug } from "@/lib/seo-taxonomy"
import { weekendEmptyState } from "@/lib/weekend-nearby"
import { DEFAULT_OG_IMAGE } from "@/lib/seo-images"

type PageProps = { params: { regionSlug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [events, regions, scopes] = await Promise.all([
    fetchEvents({ when: "ovaj-vikend", region: params.regionSlug }, { revalidate: WEEKEND_PAGE_REVALIDATE }),
    fetchRegions(),
    fetchWeekendScopes(),
  ])
  const seo = kamoZaVikendSeo({ kind: "region", slug: params.regionSlug, regions })
  // The API lists the long region slugs; the URL carries the canonical one.
  const recentlyActive = scopes.regions.some((slug) => canonicalRegionSlug(slug) === canonicalRegionSlug(params.regionSlug))
  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: events.length > 0 || recentlyActive ? undefined : { index: false, follow: true },
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
  return [] as { regionSlug: string }[];
}

export default async function KamoZaVikendRegionPage({ params }: PageProps) {
  const [events, regions] = await Promise.all([
    fetchEvents({ when: "ovaj-vikend", region: params.regionSlug }, { revalidate: WEEKEND_PAGE_REVALIDATE }),
    fetchRegions(),
  ])
  const seo = kamoZaVikendSeo({ kind: "region", slug: params.regionSlug, regions })
  const emptyState = events.length === 0
    ? await weekendEmptyState({ kind: "region", slug: params.regionSlug, name: seo.breadcrumbName })
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
        { name: seo.breadcrumbName, path: `/kamo-za-vikend/regije/${params.regionSlug}` },
      ]}
    />
  )
}
