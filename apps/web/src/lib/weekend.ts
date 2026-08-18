import { dateKey, eventEntriesOn, type CroEvent } from "@/lib/data"

const TZ = "Europe/Zagreb"

const weekdayIndex: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

function partsInZagreb(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    weekday: weekdayIndex[part("weekday")] ?? 0,
  }
}

function addLocalDays(parts: { year: number; month: number; day: number }, days: number) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12))
  return partsInZagreb(utc)
}

export type WeekendDayKey = "friday" | "saturday" | "sunday"

export type WeekendDisplayRange = {
  startKey: string
  endKey: string
  friday: Date
  saturday: Date
  sunday: Date
  longLabel: string
}

export function currentWeekendDisplayRange(now = new Date()): WeekendDisplayRange {
  const local = partsInZagreb(now)
  const daysToFriday = local.weekday <= 4 ? 4 - local.weekday : -(local.weekday - 4)
  const friday = addLocalDays(local, daysToFriday)
  const saturday = addLocalDays(friday, 1)
  const sunday = addLocalDays(friday, 2)
  const fridayDate = new Date(friday.year, friday.month - 1, friday.day)
  const saturdayDate = new Date(saturday.year, saturday.month - 1, saturday.day)
  const sundayDate = new Date(sunday.year, sunday.month - 1, sunday.day)
  return {
    startKey: dateKey(fridayDate),
    endKey: dateKey(sundayDate),
    friday: fridayDate,
    saturday: saturdayDate,
    sunday: sundayDate,
    longLabel: `od petka ${formatDayMonth(fridayDate)} do nedjelje ${formatDayMonth(sundayDate)}`,
  }
}

export function eventOccursDuringCurrentWeekend(event: CroEvent, now = new Date()) {
  const weekend = currentWeekendDisplayRange(now)
  if (event.occurrences?.length) {
    return event.occurrences.some((occurrence) => occurrence.date <= weekend.endKey && (occurrence.endDate || occurrence.date) >= weekend.startKey)
  }
  return event.date <= weekend.endKey && (event.endDate || event.date) >= weekend.startKey
}

export function groupWeekendEvents(events: CroEvent[], now = new Date()) {
  const weekend = currentWeekendDisplayRange(now)
  return {
    weekend,
    days: [
      { key: "friday" as const, label: "Petak", date: weekend.friday, events: sortDayEvents(events.flatMap((event) => eventEntriesOn(event, weekend.friday))) },
      { key: "saturday" as const, label: "Subota", date: weekend.saturday, events: sortDayEvents(events.flatMap((event) => eventEntriesOn(event, weekend.saturday))) },
      { key: "sunday" as const, label: "Nedjelja", date: weekend.sunday, events: sortDayEvents(events.flatMap((event) => eventEntriesOn(event, weekend.sunday))) },
    ],
  }
}

function sortDayEvents(events: CroEvent[]) {
  return [...events].sort((a, b) => {
    const time = (a.startsAtISO || `${a.date}T${a.time}`).localeCompare(b.startsAtISO || `${b.date}T${b.time}`)
    if (time !== 0) return time
    return a.title.localeCompare(b.title, "hr") || a.slug.localeCompare(b.slug, "hr")
  })
}

function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "long" }).format(date)
}
