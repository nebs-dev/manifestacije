import Link from "next/link"
import { EventCard } from "@/components/public/event-card"
import { SiteFooter } from "@/components/public/site-footer"
import { SiteHeader } from "@/components/public/site-header"
import { dateParts, type CroEvent } from "@/lib/data"
import { breadcrumbsToJsonLd, safeJsonLdString } from "@/lib/event-jsonld"
import { WEB_URL } from "@/lib/public-api"
import { groupWeekendEvents } from "@/lib/weekend"

type BreadcrumbItem = { name: string; path: string }

export function WeekendLanding({
  events,
  eyebrow,
  h1,
  intro,
  breadcrumbs,
}: {
  events: CroEvent[]
  eyebrow: string
  h1: string
  intro: string
  breadcrumbs: BreadcrumbItem[]
}) {
  const grouped = groupWeekendEvents(events)
  const visibleDays = grouped.days.filter((day) => day.events.length > 0)
  const breadcrumbJsonLd = breadcrumbsToJsonLd(breadcrumbs, WEB_URL)
  let priorityImageUsed = false

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">{eyebrow}</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">{h1}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{intro}</p>
        <p className="mb-8 mt-3 text-muted-foreground">
          {events.length} {events.length === 1 ? "događanje" : "događanja"} {grouped.weekend.longLabel}.
        </p>

        {visibleDays.length > 0 ? (
          <div className="flex flex-col gap-12">
            {visibleDays.map((day) => {
              const parts = dateParts(dateKeyFromDate(day.date))
              const displayDate = dateKeyFromDate(day.date)
              return (
                <section key={day.key}>
                  <div className="mb-5">
                    <h2 className="font-heading text-2xl font-semibold">{day.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {parts.day}. {parts.monthLong} · {day.events.length} {day.events.length === 1 ? "događanje" : "događanja"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {day.events.map((event) => {
                      const priorityImage = !priorityImageUsed
                      priorityImageUsed = true
                      return (
                        <EventCard
                          key={`${day.key}-${event.slug}`}
                          event={{ ...event, date: displayDate }}
                          priorityImage={priorityImage}
                          imageSizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-heading text-xl font-semibold">Trenutačno nemamo objavljenih događanja za ovaj vikend.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href="/eventi" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Sva nadolazeća događanja
              </Link>
              <Link href="/dodaj-event" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                Dodaj događaj
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}

function dateKeyFromDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
