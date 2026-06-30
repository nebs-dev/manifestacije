import { EventCard } from "@/components/event-card"
import type { CroEvent } from "@/lib/data"

export function EventRail({ events }: { events: CroEvent[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
      {events.map((event) => (
        <div key={event.slug} className="w-[78%] shrink-0 snap-start sm:w-[44%] md:w-auto">
          <EventCard event={event} />
        </div>
      ))}
    </div>
  )
}
