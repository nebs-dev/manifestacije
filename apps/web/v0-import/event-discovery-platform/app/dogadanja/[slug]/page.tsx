import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Ticket,
  Building2,
  ExternalLink,
  Baby,
  Trees,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { EventPoster } from "@/components/event-poster"
import { EventCard } from "@/components/event-card"
import { CategoryBadge, PriceBadge } from "@/components/badges"
import { ShareButton } from "@/components/share-button"
import {
  events,
  getEvent,
  regionName,
  formatDateRange,
  relatedEvents,
  priceLabel,
} from "@/lib/data"

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const event = getEvent(slug)
  if (!event) return { title: "Događanje" }
  return {
    title: event.title,
    description: event.description,
    openGraph: { title: event.title, description: event.description, images: event.image ? [event.image] : [] },
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = getEvent(slug)
  if (!event) notFound()

  const related = relatedEvents(event)

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero image */}
        <section className="relative isolate h-[44vh] min-h-[320px] w-full overflow-hidden bg-ink text-ink-foreground md:h-[56vh]">
          <div className="absolute inset-0">
            <EventPoster image={event.image} title={event.title} category={event.category} sizes="100vw" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/20" aria-hidden />
          <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-end px-4 pb-8">
            <Link
              href="/dogadanja"
              className="absolute left-4 top-6 inline-flex items-center gap-1.5 rounded-full bg-ink/40 px-3 py-1.5 text-sm text-ink-foreground backdrop-blur hover:bg-ink/60"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Natrag
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={event.category} className="border-transparent bg-ink-foreground/15 text-ink-foreground backdrop-blur" />
              <PriceBadge free={event.free} price={event.price} />
            </div>
            <h1 className="mt-3 max-w-3xl text-balance font-heading text-3xl font-semibold leading-tight text-shadow-lg md:text-5xl">
              {event.title}
            </h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-ink-foreground/85">
              <MapPin className="size-4" aria-hidden />
              {event.venue}, {event.city} · {regionName(event.region)}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
            {/* Main content */}
            <article>
              <p className="text-pretty text-lg leading-relaxed text-foreground/90">{event.description}</p>
              <div className="mt-6 space-y-4 text-pretty leading-relaxed text-muted-foreground">
                {event.longDescription.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              {(event.forKids || event.outdoor) && (
                <div className="mt-8 flex flex-wrap gap-3">
                  {event.forKids && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">
                      <Baby className="size-4" aria-hidden />
                      Pogodno za djecu
                    </span>
                  )}
                  {event.outdoor && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">
                      <Trees className="size-4" aria-hidden />
                      Na otvorenom
                    </span>
                  )}
                </div>
              )}

              <div className="mt-10 rounded-2xl border border-border bg-muted/50 p-5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Izvor podataka:</span> {event.source}
              </div>
            </article>

            {/* Sidebar */}
            <aside>
              <div className="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-poster">
                <dl className="space-y-5">
                  <InfoRow icon={<CalendarDays className="size-5" aria-hidden />} label="Datum">
                    {formatDateRange(event.date, event.endDate)}
                  </InfoRow>
                  <InfoRow icon={<Clock className="size-5" aria-hidden />} label="Vrijeme">
                    {event.time}
                  </InfoRow>
                  <InfoRow icon={<MapPin className="size-5" aria-hidden />} label="Lokacija">
                    {event.venue}
                    <span className="block text-muted-foreground">
                      {event.city}, {regionName(event.region)}
                    </span>
                  </InfoRow>
                  <InfoRow icon={<Building2 className="size-5" aria-hidden />} label="Organizator">
                    {event.organizer}
                  </InfoRow>
                  <InfoRow icon={<Ticket className="size-5" aria-hidden />} label="Ulaznica">
                    {priceLabel(event)}
                  </InfoRow>
                </dl>

                <div className="mt-6 flex flex-col gap-3">
                  {event.ticketUrl ? (
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Ticket className="size-4" aria-hidden />
                      {event.free ? "Rezerviraj mjesto" : "Kupi ulaznicu"}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : (
                    <span className="rounded-full bg-muted px-5 py-3 text-center text-sm font-medium text-muted-foreground">
                      Ulaz slobodan
                    </span>
                  )}
                  <ShareButton title={event.title} />
                </div>
              </div>
            </aside>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-16 border-t border-border pt-12">
              <h2 className="mb-6 font-heading text-2xl font-semibold">Slična događanja</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((e) => (
                  <EventCard key={e.slug} event={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <div className="text-sm">
        <dt className="font-semibold uppercase tracking-wide text-muted-foreground text-[0.7rem]">{label}</dt>
        <dd className="mt-0.5 font-medium text-foreground">{children}</dd>
      </div>
    </div>
  )
}
