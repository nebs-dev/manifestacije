import type { Metadata } from "next"
import { WeekendLanding } from "@/components/public/weekend-landing"
import { fetchEvents, fetchWeekendScopes } from "@/lib/public-api"
import { kamoZaVikendSeo } from "@/lib/weekend-seo"
import { DEFAULT_OG_IMAGE } from "@/lib/seo-images"

type PageProps = { params: { citySlug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [events, scopes] = await Promise.all([
    fetchEvents({ when: "ovaj-vikend", city: params.citySlug }),
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

export const revalidate = 0;

export default async function KamoZaVikendCityPage({ params }: PageProps) {
  const events = await fetchEvents({ when: "ovaj-vikend", city: params.citySlug })
  const seo = kamoZaVikendSeo({ kind: "city", slug: params.citySlug, events })
  return (
    <WeekendLanding
      events={events}
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
