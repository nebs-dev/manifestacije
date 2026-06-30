import { EventCard } from "@/components/event-card"
import type { CroEvent } from "@/lib/data"
import { CalendarX } from "lucide-react"

export function ResultsGrid({ events }: { events: CroEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <CalendarX className="size-10 text-muted-foreground" aria-hidden />
        <p className="mt-4 font-heading text-xl font-semibold">Nema rezultata</p>
        <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
          Pokušaj prilagoditi filtre ili pretragu kako bi pronašao više događanja.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.slug} event={event} />
      ))}
    </div>
  )
}
