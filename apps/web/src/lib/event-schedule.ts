import { eventDisplayEnd } from "./event-end"
import type { CroEvent, CroEventOccurrence } from "./data"

const TZ = "Europe/Zagreb"

const ZAGREB_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function effectiveOccurrences(event: CroEvent): CroEventOccurrence[] {
  if (event.occurrences?.length) return event.occurrences
  if (!event.startsAtISO) return []
  return [{
    id: "legacy",
    date: event.date,
    endDate: event.endDate,
    startsAtISO: event.startsAtISO,
    endsAtISO: event.endsAtISO,
    time: event.time,
    allDay: event.allDay === true,
  }]
}

export function eventForOccurrence(event: CroEvent, occurrence: CroEventOccurrence): CroEvent {
  return {
    ...event,
    date: occurrence.date,
    endDate: occurrence.endDate,
    startsAtISO: occurrence.startsAtISO,
    endsAtISO: occurrence.endsAtISO,
    time: occurrence.time,
    allDay: occurrence.allDay,
    displayOccurrenceId: occurrence.id,
  }
}

export function eventHasEnded(event: CroEvent, now = new Date()) {
  const occurrences = effectiveOccurrences(event)
  if (occurrences.length === 0) {
    return (event.endDate ?? event.date) < ZAGREB_DATE.format(now)
  }

  const today = ZAGREB_DATE.format(now)
  return occurrences.every((occurrence) => {
    if (occurrence.allDay && !occurrence.endsAtISO) {
      return (occurrence.endDate ?? occurrence.date) < today
    }
    return occurrence.endsAtISO
      ? new Date(occurrence.endsAtISO) <= now
      : new Date(occurrence.startsAtISO) < now
  })
}

export function formatOccurrenceLabel(occurrence: CroEventOccurrence, includeYear = false) {
  const start = new Date(occurrence.startsAtISO)
  const end = occurrence.endsAtISO ? new Date(occurrence.endsAtISO) : null
  const date = new Intl.DateTimeFormat("hr-HR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(start)
  if (occurrence.allDay) return `${date} · Cijeli dan`

  const time = (value: Date) => new Intl.DateTimeFormat("hr-HR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
  if (!end) return `${date} · ${time(start)}`
  const displayEnd = eventDisplayEnd(start, end)
  const endTime = ZAGREB_DATE.format(displayEnd) !== ZAGREB_DATE.format(end) ? "24:00" : time(end)
  const endDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(displayEnd)
  if (endDate === occurrence.date) return `${date} · ${time(start)}–${endTime}`
  const endLabel = new Intl.DateTimeFormat("hr-HR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  }).format(displayEnd)
  return `${date} · ${time(start)} – ${endLabel} · ${endTime}`
}
