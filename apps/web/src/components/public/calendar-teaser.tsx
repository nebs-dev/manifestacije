import { ArrowRight, CalendarDays } from "lucide-react"
import { TrackedDiscoveryLink } from "@/components/public/tracked-discovery-link"

const TZ = "Europe/Zagreb"

function dateLabel(date: string) {
  const value = new Date(`${date}T12:00:00Z`)
  return {
    weekday: new Intl.DateTimeFormat("hr-HR", { timeZone: TZ, weekday: "short" }).format(value),
    day: new Intl.DateTimeFormat("hr-HR", { timeZone: TZ, day: "numeric" }).format(value),
    month: new Intl.DateTimeFormat("hr-HR", { timeZone: TZ, month: "short" }).format(value),
  }
}

export function CalendarTeaser({ dates }: { dates: string[] }) {
  return (
    <section className="py-8 md:py-10" aria-labelledby="calendar-teaser-title">
      <div className="overflow-hidden rounded-3xl border border-border bg-muted/50 px-5 py-6 shadow-poster sm:px-7 md:flex md:items-center md:gap-8">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent-foreground">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="calendar-teaser-title" className="font-heading text-2xl font-semibold">Planiraš unaprijed?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Pregledaj događanja po datumima i pronađi što se događa sljedećih dana.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 md:mt-0 md:shrink-0" aria-label="Nadolazeći datumi">
          {dates.map((date) => {
            const label = dateLabel(date)
            return (
              <time key={date} dateTime={date} className="flex min-w-14 flex-col items-center rounded-2xl border border-border bg-background px-3 py-2 text-center">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">{label.weekday}</span>
                <span className="font-heading text-lg font-semibold leading-tight">{label.day}</span>
                <span className="text-[11px] text-muted-foreground">{label.month}</span>
              </time>
            )
          })}
        </div>

        <TrackedDiscoveryLink
          href="/kalendar"
          sourcePage="home"
          sourceComponent="calendar_teaser"
          className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 md:mt-0"
        >
          Otvori kalendar
          <ArrowRight className="size-4" aria-hidden />
        </TrackedDiscoveryLink>
      </div>
    </section>
  )
}
