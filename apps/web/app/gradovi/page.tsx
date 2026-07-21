import type { Metadata } from "next"
import Link from "next/link"
import { MapPin } from "lucide-react"
import { SiteHeader } from "@/components/public/site-header"
import { SiteFooter } from "@/components/public/site-footer"
import { breadcrumbsToJsonLd, safeJsonLdString } from "@/lib/event-jsonld"
import { fetchEvents, WEB_URL } from "@/lib/public-api"
import { cityEventSummaries } from "@/lib/seo-taxonomy"

export const metadata: Metadata = {
  title: { absolute: "Događanja po gradovima | Manifestacije" },
  description: "Pregled gradova s aktualnim događanjima, manifestacijama i eventima na Manifestacije.hr.",
  alternates: { canonical: `${WEB_URL}/gradovi` },
  openGraph: {
    type: "website",
    title: "Događanja po gradovima | Manifestacije",
    description: "Pregled gradova s aktualnim događanjima, manifestacijama i eventima na Manifestacije.hr.",
    url: `${WEB_URL}/gradovi`,
  },
}

export default async function CitiesPage() {
  const events = await fetchEvents()
  const cities = cityEventSummaries(events)

  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    [
      { name: "Početna", path: "/" },
      { name: "Gradovi", path: "/gradovi" },
    ],
    WEB_URL,
  )

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Gradovi</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-5xl">Događanja po gradovima</h1>
        <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
          Istraži gradove koji trenutno imaju objavljena nadolazeća događanja, manifestacije i evente.
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => (
            <Link
              key={city.slug}
              href={`/gradovi/${city.slug}`}
              className="group rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-poster"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="size-4 text-primary/70" aria-hidden />
                Grad
              </span>
              <h2 className="mt-3 font-heading text-2xl font-semibold group-hover:text-primary">{city.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {city.count} {city.count === 1 ? "događanje" : "događanja"}
              </p>
            </Link>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
