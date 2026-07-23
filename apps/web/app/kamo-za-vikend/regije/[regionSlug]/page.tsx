import type { Metadata } from "next"
import { WeekendLanding } from "@/components/public/weekend-landing"
import { fetchEvents, fetchRegions } from "@/lib/public-api"
import { kamoZaVikendSeo } from "@/lib/weekend-seo"

type PageProps = { params: { regionSlug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [events, regions] = await Promise.all([
    fetchEvents({ when: "ovaj-vikend", region: params.regionSlug }),
    fetchRegions(),
  ])
  const seo = kamoZaVikendSeo({ kind: "region", slug: params.regionSlug, regions })
  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: events.length > 0 ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
    },
  }
}

export default async function KamoZaVikendRegionPage({ params }: PageProps) {
  const [events, regions] = await Promise.all([
    fetchEvents({ when: "ovaj-vikend", region: params.regionSlug }),
    fetchRegions(),
  ])
  const seo = kamoZaVikendSeo({ kind: "region", slug: params.regionSlug, regions })
  return (
    <WeekendLanding
      events={events}
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
