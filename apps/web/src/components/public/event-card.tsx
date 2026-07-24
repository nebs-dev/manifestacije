import Link from "next/link"
import { MapPin } from "lucide-react"
import type { CroEvent } from "@/lib/data"
import { EventPoster } from "@/components/public/event-poster"
import { DateBadge } from "@/components/public/date-badge"
import { CategoryBadge, PriceBadge } from "@/components/public/badges"
import { publicAddressLine } from "@/lib/location-display"
import { cn } from "@/lib/utils"
import { eventCardDateDisplay } from "./event-card-display"

interface EventCardProps {
  event: CroEvent
  className?: string
  displayDate?: string
  priorityImage?: boolean
  imageSizes?: string
}

export function EventCard({ event, className, displayDate, priorityImage, imageSizes }: EventCardProps) {
  const dateForCard = eventCardDateDisplay(event.date, displayDate)
  const locationLabel = publicAddressLine(event.address, event.city, event.venue) ?? event.city
  return (
    <Link
      href={`/eventi/${event.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-poster transition-all duration-300 [contain-intrinsic-size:420px] [content-visibility:auto] hover:-translate-y-1 hover:shadow-poster-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
          <EventPoster
            image={event.image}
            title={event.title}
            alt={event.title}
            category={event.category}
            priority={priorityImage}
            sizes={imageSizes}
          />
        </div>
        {event.image && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        )}
        <div className="absolute left-4 top-4">
          <DateBadge date={dateForCard.date} size="md" />
        </div>
        <div className="absolute right-4 top-4">
          <PriceBadge free={event.free} price={event.price} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-accent-foreground/90">
            {dateForCard.weekday}
          </span>
          {!event.allDay && (
            <>
              <span aria-hidden>·</span>
              <span>{event.time}</span>
            </>
          )}
        </div>

        <h3 className="font-heading text-xl font-semibold leading-snug text-pretty transition-colors group-hover:text-primary">
          {event.title}
        </h3>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0 text-primary/70" />
          <span className="truncate">
            {locationLabel}
          </span>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {event.description}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {(event.categories.length > 0 ? event.categories : [{ slug: event.category, name: event.category }])
            .map((c) => (
              <CategoryBadge key={c.slug} category={c.slug} label={c.name} />
            ))}
        </div>
      </div>
    </Link>
  )
}
