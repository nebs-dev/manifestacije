"use client"

import { CalendarPlus } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { trackEvent } from "@/lib/analytics"
import { canAddToCalendar, googleCalendarUrl } from "@/lib/calendar"
import type { CroEvent } from "@/lib/data"
import { effectiveOccurrences, formatOccurrenceLabel } from "@/lib/event-schedule"

export function AddToCalendarButton({ event, compact = false }: { event: CroEvent; compact?: boolean }) {
  if (!canAddToCalendar(event)) return null
  const occurrences = effectiveOccurrences(event)

  const track = (provider: "google" | "ics") =>
    trackEvent({ name: "calendar_provider_selected", params: { event_slug: event.slug, event_title: event.title, provider } })

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) trackEvent({ name: "calendar_clicked", params: { event_slug: event.slug, event_title: event.title } })
      }}
    >
      <PopoverTrigger
        render={
          compact ? (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            />
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            />
          )
        }
      >
        <CalendarPlus className={compact ? "size-3" : "size-4"} aria-hidden /> Dodaj u kalendar
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="flex flex-col gap-1">
          {occurrences.map((occurrence) => (
            <a
              key={occurrence.id}
              href={googleCalendarUrl(event, occurrence.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("google")}
              className="rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              {occurrences.length === 1 ? "Google Calendar" : `Google · ${formatOccurrenceLabel(occurrence)}`}
            </a>
          ))}
          <a
            href={`/eventi/${event.slug}/calendar.ics`}
            onClick={() => track("ics")}
            className="rounded px-2 py-1.5 text-sm hover:bg-muted"
          >
            Preuzmi (.ics)
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}
