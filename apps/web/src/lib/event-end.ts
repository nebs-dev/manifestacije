const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit",
})

export function zagrebDateKey(date = new Date()): string {
  return dateFormatter.format(date)
}

export function isOvernightEvent(start: Date, end: Date, allDay = false): boolean {
  const duration = end.getTime() - start.getTime()
  if (allDay || !(duration > 0 && duration < 86_400_000)) return false
  const nextDay = new Date(`${zagrebDateKey(start)}T12:00:00Z`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  if (zagrebDateKey(end) !== nextDay.toISOString().slice(0, 10)) return false
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(end)
  return time <= "06:00:00" && (time !== "06:00:00" || end.getUTCMilliseconds() === 0)
}

/** Presentation/grouping only. APIs, JSON-LD and exports retain actual endsAt. */
export function eventDisplayEnd(start: Date, end: Date, allDay = false): Date {
  if (isOvernightEvent(start, end, allDay)) return start
  return !allDay && end > start ? new Date(end.getTime() - 1) : end
}

export function eventTimeLabel(event: { time: string; startsAtISO?: string; endsAtISO?: string; allDay?: boolean }): string {
  if (!event.startsAtISO || !event.endsAtISO) return event.time
  const start = new Date(event.startsAtISO)
  const end = new Date(event.endsAtISO)
  if (!isOvernightEvent(start, end, event.allDay)) return event.time
  const time = new Intl.DateTimeFormat("hr-HR", {
    timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit",
  }).format(end)
  return `${event.time}–${time}`
}
