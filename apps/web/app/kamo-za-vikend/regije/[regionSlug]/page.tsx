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
    fetchEvents({ when: "ovaj-vikend", region: params.regionSlug }),
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

export const revalidate = 0;

export default async function KamoZaVikendRegionPage({ params }: PageProps) {
  const [events, regions] = await Promise.all([
    fetchEvents({ when: "ovaj-vikend", region: params.regionSlug }),
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
