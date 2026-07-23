import { EventCard } from "@/components/public/event-card"
import type { CroEvent } from "@/lib/data"

export function EventRail({ events }: { events: CroEvent[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:items-stretch md:gap-6 md:overflow-visible md:px-0">
      {events.map((event, index) => (
        <div key={event.slug} className="w-[78%] shrink-0 snap-start sm:w-[44%] md:h-full md:w-auto">
          <EventCard
            event={event}
            priorityImage={index === 0}
            imageSizes="(max-width: 640px) 78vw, (max-width: 768px) 44vw, 33vw"
          />
        </div>
      ))}
    </div>
  )
}
