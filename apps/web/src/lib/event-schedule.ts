import type { CroEvent, CroEventOccurrence } from "./data"

const TZ = "Europe/Zagreb"

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
  const endDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(end)
  if (endDate === occurrence.date) return `${date} · ${time(start)}–${time(end)}`
  const endLabel = new Intl.DateTimeFormat("hr-HR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  }).format(end)
  return `${date} · ${time(start)} – ${endLabel} · ${time(end)}`
}
