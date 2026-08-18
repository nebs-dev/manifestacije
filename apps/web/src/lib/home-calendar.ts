type CalendarDateSource = {
  date: string
  occurrences?: Array<{ date: string }>
}

const TZ = "Europe/Zagreb"

function zagrebDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function calendarTeaserDates(events: CalendarDateSource[], now = new Date()): string[] {
  const today = zagrebDateKey(now)
  const eventDates = [...new Set(events.flatMap((event) =>
    event.occurrences?.length ? event.occurrences.map((occurrence) => occurrence.date) : [event.date]
  ))]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today)
    .sort()
    .slice(0, 4)

  const [year, month, day] = today.split("-").map(Number)
  const result = [...eventDates]
  for (let index = 0; result.length < 4; index += 1) {
    const fallback = new Date(Date.UTC(year, month - 1, day + index)).toISOString().slice(0, 10)
    if (!result.includes(fallback)) result.push(fallback)
  }
  return result.sort().slice(0, 4)
}
