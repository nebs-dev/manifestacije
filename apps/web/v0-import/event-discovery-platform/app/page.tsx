import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { HomeHero } from "@/components/home-hero"
import { SectionHeading } from "@/components/section-heading"
import { EventRail } from "@/components/event-rail"
import { RegionGrid } from "@/components/region-grid"
import { CategoryStrip } from "@/components/category-strip"
import { OrganizerCta } from "@/components/organizer-cta"
import { EventCard } from "@/components/event-card"
import { featuredEvents, upcomingEvents, freeEvents } from "@/lib/data"

export default function Page() {
  const featured = featuredEvents(3)
  const upcoming = upcomingEvents(6)
  const free = freeEvents(3)

  return (
    <>
      <SiteHeader />
      <main>
        <HomeHero />

        <div className="mx-auto max-w-6xl px-4">
          {/* Featured */}
          <section className="py-14 md:py-20">
            <SectionHeading
              eyebrow="Izdvojeno"
              title="Događanja koja ne želiš propustiti"
              description="Ručno odabrani vrhunci sezone diljem zemlje."
              href="/dogadanja"
              linkLabel="Sva događanja"
            />
            <EventRail events={featured} />
          </section>

          {/* Regions */}
          <section className="py-14 md:py-20">
            <SectionHeading
              eyebrow="Po regijama"
              title="Istraži Hrvatsku"
              description="Od dalmatinske obale do slavonskih ravnica — svaka regija nosi svoj ritam."
            />
            <RegionGrid />
          </section>

          {/* Upcoming */}
          <section className="py-14 md:py-20">
            <SectionHeading
              eyebrow="Uskoro"
              title="Nadolazeća događanja"
              href="/dogadanja"
              linkLabel="Pogledaj sve"
            />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => (
                <EventCard key={event.slug} event={event} />
              ))}
            </div>
          </section>

          {/* Categories */}
          <section className="py-14 md:py-20">
            <SectionHeading
              eyebrow="Po kategoriji"
              title="Pronađi svoj žanr"
              description="Koncerti, festivali, radionice i još mnogo toga."
            />
            <CategoryStrip />
          </section>

          {/* Free events banner */}
          <section className="py-14 md:py-20">
            <SectionHeading
              eyebrow="Bez ulaznice"
              title="Besplatna događanja"
              description="Kultura dostupna svima — bez troška."
              href="/dogadanja?besplatno=1"
              linkLabel="Sva besplatna"
            />
            <EventRail events={free} />
          </section>
        </div>

        <OrganizerCta />

        {/* Map teaser */}
        <section className="border-t border-border bg-ink py-16 text-ink-foreground md:py-24">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center">
            <h2 className="max-w-2xl text-balance font-heading text-3xl font-semibold md:text-4xl">
              Vidi sva događanja na karti
            </h2>
            <p className="mt-4 max-w-lg text-pretty text-ink-foreground/75 leading-relaxed">
              Otkrij što se zbiva u tvojoj blizini ili planiraj putovanje uz interaktivnu kartu cijele Hrvatske.
            </p>
            <Link
              href="/karta"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Otvori kartu
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
