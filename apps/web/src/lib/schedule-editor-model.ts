import { eventDisplayEnd } from "./event-end"

export type ScheduleRow = {
  key: string
  id?: number
  date: string
  endDate?: string
  startTime: string
  endTime: string
  isAllDay: boolean
}

type ApiOccurrence = { id?: number; startsAt: string; endsAt?: string | null; isAllDay?: boolean | null }

const TZ = "Europe/Zagreb"

function partsInZagreb(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return { date: "", time: "" }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ""
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` }
}

function offsetMinutesAt(utc: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(utc)
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0"
  const match = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)
  return match[1] === "-" ? -minutes : minutes
}

function zagrebLocalToIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const first = new Date(rough.getTime() - offsetMinutesAt(rough) * 60_000)
  return new Date(rough.getTime() - offsetMinutesAt(first) * 60_000).toISOString()
}

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

export function addWeek(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10)
}

export function scheduleRowsFromEvent(input: {
  startsAt?: string | null
  endsAt?: string | null
  isAllDay?: boolean | null
  occurrences?: ApiOccurrence[]
}): ScheduleRow[] {
  const source = input.occurrences?.length
    ? input.occurrences
    : input.startsAt ? [{ startsAt: input.startsAt, endsAt: input.endsAt, isAllDay: input.isAllDay }] : []
  if (!source.length) return [emptyScheduleRow()]
  return source.map((occurrence, index) => {
    const start = partsInZagreb(occurrence.startsAt)
    const end = occurrence.endsAt ? partsInZagreb(occurrence.endsAt) : null
    const endsAtMidnightOnStartingDay = !occurrence.isAllDay && occurrence.endsAt &&
      end?.time === "00:00" && start.time !== "00:00" &&
      partsInZagreb(eventDisplayEnd(new Date(occurrence.startsAt), new Date(occurrence.endsAt))).date === start.date
    return {
      key: occurrence.id ? `occurrence-${occurrence.id}` : `initial-${index}`,
      id: occurrence.id,
      date: start.date,
      endDate: !endsAtMidnightOnStartingDay && end?.date && end.date !== start.date ? end.date : undefined,
      startTime: occurrence.isAllDay ? "" : start.time,
      endTime: occurrence.isAllDay ? "" : end?.time ?? "",
      isAllDay: occurrence.isAllDay === true,
    }
  })
}

export function emptyScheduleRow(): ScheduleRow {
  return { key: `new-${Date.now()}-${Math.random()}`, date: "", endDate: undefined, startTime: "18:00", endTime: "", isAllDay: false }
}

export function scheduleRowsToApi(rows: ScheduleRow[]) {
  return rows.map((row) => {
    if (!row.date) throw new Error("Svaki termin mora imati datum.")
    if (row.isAllDay) {
      const allDayEndDate = row.endDate || row.date
      return {
        ...(row.id ? { id: row.id } : {}),
        startsAt: zagrebLocalToIso(row.date, "00:00"),
        endsAt: zagrebLocalToIso(allDayEndDate, "23:59"),
        isAllDay: true,
      }
    }
    if (!row.startTime) throw new Error("Svaki termin mora imati vrijeme početka.")
    if (row.endTime && row.endTime === row.startTime) throw new Error("Vrijeme završetka ne može biti jednako početku.")
    const endDate = row.endDate || (row.endTime && row.endTime < row.startTime ? nextDate(row.date) : row.date)
    return {
      ...(row.id ? { id: row.id } : {}),
      startsAt: zagrebLocalToIso(row.date, row.startTime),
      endsAt: row.endTime ? zagrebLocalToIso(endDate, row.endTime) : undefined,
      isAllDay: false,
    }
  })
}
