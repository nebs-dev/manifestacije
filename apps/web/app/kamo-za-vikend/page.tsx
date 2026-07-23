import type { Metadata } from "next"
import { WeekendLanding } from "@/components/public/weekend-landing"
import { fetchEvents } from "@/lib/public-api"
import { kamoZaVikendSeo } from "@/lib/weekend-seo"

const seo = kamoZaVikendSeo({ kind: "global" })

export async function generateMetadata(): Promise<Metadata> {
  const events = await fetchEvents({ when: "ovaj-vikend" })
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

export default async function KamoZaVikendPage() {
  const events = await fetchEvents({ when: "ovaj-vikend" })
  return (
    <WeekendLanding
      events={events}
      eyebrow={seo.eyebrow}
      h1={seo.h1}
      intro={seo.description}
      breadcrumbs={[
        { name: "Početna", path: "/" },
        { name: "Kamo za vikend", path: "/kamo-za-vikend" },
      ]}
    />
  )
}
