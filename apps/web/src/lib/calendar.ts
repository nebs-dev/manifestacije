import type { CroEvent } from "./data"

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000
const MAX_DESCRIPTION_LENGTH = 500

// RFC 5545 §3.3.11: backslash, semicolon, comma and newline are structural
// and must be escaped, or a raw one breaks the surrounding VEVENT block for
// every downstream parser (Google, Apple, Outlook alike).
function escapeICSText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

// Lines longer than 75 octets must be "folded" (CRLF + leading space) per
// RFC 5545 §3.1 — some strict clients (Apple Calendar in particular) mis-parse
// unfolded long lines instead of just ignoring the limit.
function foldICSLine(line: string) {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let rest = line
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75))
    rest = rest.slice(75)
  }
  chunks.push(rest)
  return chunks.join("\r\n ")
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "")
}

function formatICSDateTime(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

// Calendar-date-only formatting deliberately does NOT go through Date/UTC
// conversion — `iso` already carries the Zagreb wall-clock date (e.g.
// "2026-08-01T00:00:00+02:00"), and shifting it to UTC first can roll it back
// to the previous day. Slice the date the source already gives us.
function formatICSDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, "")
}

// ICS/Google `DTEND` for all-day events is exclusive (RFC 5545 §3.6.1), but
// `endsAt` in our data is the last inclusive day of the event (see
// eventOccursOn's `key <= end` in data.ts) — so it always needs +1 day here.
function addDaysToICSDate(icsDate: string, days: number) {
  const year = Number(icsDate.slice(0, 4))
  const month = Number(icsDate.slice(4, 6))
  const day = Number(icsDate.slice(6, 8))
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10).replace(/-/g, "")
}

function allDayRange(event: CroEvent, start: string) {
  const startDate = formatICSDate(start)
  const lastInclusiveDate = event.endsAtISO ? formatICSDate(event.endsAtISO) : startDate
  return { start: startDate, end: addDaysToICSDate(lastInclusiveDate, 1) }
}

function calendarDescription(event: CroEvent) {
  const plain = stripHtml(event.description).trim().slice(0, MAX_DESCRIPTION_LENGTH)
  const lines = [plain, `Organizator: ${event.organizer}`, `Više informacija: ${event.source}`]
  return lines.filter(Boolean).join("\n\n")
}

function calendarLocation(event: CroEvent) {
  const venue = event.venue && event.venue !== event.city ? event.venue : undefined
  return [venue, event.address, event.city].filter(Boolean).join(", ")
}

export function canAddToCalendar(event: CroEvent) {
  return Boolean(event.startsAtISO)
}

// Pure ICS (RFC 5545) generator — one VEVENT per event page, no recurrence,
// no calendar-API auth. `endsAt` fallback mirrors the product spec: 2h for
// timed events, 1 day for all-day, when the source data has no explicit end.
export function eventToICS(event: CroEvent): string {
  const start = event.startsAtISO
  if (!start) throw new Error(`eventToICS: event "${event.slug}" has no startsAtISO`)

  const uid = `${event.slug}@manifestacije.hr`
  const now = formatICSDateTime(new Date().toISOString())
  const summary = escapeICSText(event.title)
  const description = escapeICSText(calendarDescription(event))
  const location = escapeICSText(calendarLocation(event))

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Manifestacije.hr//Add to Calendar//HR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
  ]

  if (event.allDay) {
    const range = allDayRange(event, start)
    lines.push(`DTSTART;VALUE=DATE:${range.start}`, `DTEND;VALUE=DATE:${range.end}`)
  } else {
    const endIso = event.endsAtISO ?? new Date(new Date(start).getTime() + DEFAULT_DURATION_MS).toISOString()
    lines.push(`DTSTART:${formatICSDateTime(start)}`, `DTEND:${formatICSDateTime(endIso)}`)
  }

  lines.push(
    `SUMMARY:${foldICSLine(summary)}`,
    `DESCRIPTION:${foldICSLine(description)}`,
    `LOCATION:${foldICSLine(location)}`,
    `URL:${event.source}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Podsjetnik",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  )

  return lines.join("\r\n")
}

export function googleCalendarUrl(event: CroEvent): string {
  const start = event.startsAtISO
  if (!start) throw new Error(`googleCalendarUrl: event "${event.slug}" has no startsAtISO`)

  const url = new URL("https://calendar.google.com/calendar/render")
  url.searchParams.set("action", "TEMPLATE")
  url.searchParams.set("text", event.title)
  url.searchParams.set("details", calendarDescription(event))
  url.searchParams.set("location", calendarLocation(event))

  if (event.allDay) {
    const range = allDayRange(event, start)
    url.searchParams.set("dates", `${range.start}/${range.end}`)
  } else {
    const endIso = event.endsAtISO ?? new Date(new Date(start).getTime() + DEFAULT_DURATION_MS).toISOString()
    url.searchParams.set("dates", `${formatICSDateTime(start)}/${formatICSDateTime(endIso)}`)
  }

  return url.toString()
}
