import type { Metadata } from "next"
import { WeekendLanding } from "@/components/public/weekend-landing"
import { fetchEvents } from "@/lib/public-api"
import { kamoZaVikendSeo } from "@/lib/weekend-seo"

type PageProps = { params: { citySlug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const events = await fetchEvents({ when: "ovaj-vikend", city: params.citySlug })
  const seo = kamoZaVikendSeo({ kind: "city", slug: params.citySlug, events })
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
