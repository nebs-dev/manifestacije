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
    // A plain overnight slot (22:00 -> 02:00 next day) is expressed by the
    // earlier end time alone, so the editor shows no separate end date.
    const implicitOvernight = !occurrence.isAllDay && end && end.date === nextDate(start.date) && end.time < start.time
    return {
      key: occurrence.id ? `occurrence-${occurrence.id}` : `initial-${index}`,
      id: occurrence.id,
      date: start.date,
      endDate: !endsAtMidnightOnStartingDay && !implicitOvernight && end?.date && end.date !== start.date ? end.date : undefined,
      startTime: occurrence.isAllDay ? "" : start.time,
      endTime: occurrence.isAllDay ? "" : end?.time ?? "",
      isAllDay: occurrence.isAllDay === true,
    }
  })
}

export function emptyScheduleRow(): ScheduleRow {
  return { key: `new-${Date.now()}-${Math.random()}`, date: "", endDate: undefined, startTime: "18:00", endTime: "", isAllDay: false }
}

function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Applies an edit to one row. Moving the start date keeps a separate end
 *  date the same number of days after it, so a multi-day or overnight range
 *  is not left ending before it starts. */
export function patchScheduleRow(row: ScheduleRow, patch: Partial<ScheduleRow>): ScheduleRow {
  const next = { ...row, ...patch }
  if (patch.date && row.date && row.endDate && !("endDate" in patch)) {
    next.endDate = shiftDate(row.endDate, daysBetween(row.date, patch.date))
  }
  if (next.endDate === next.date) next.endDate = undefined
  return next
}

/** Removes only the end (date and time) of a row; start and all-day stay. */
export function clearScheduleRowEnd(row: ScheduleRow): ScheduleRow {
  return { ...row, endDate: undefined, endTime: "" }
}

export function scheduleRowsToApi(rows: ScheduleRow[]) {
  return rows.map((row) => {
    if (!row.date) throw new Error("Svaki termin mora imati datum.")
    if (row.endDate && row.endDate < row.date) throw new Error("Datum završetka ne može biti prije datuma početka.")
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
    const hasEndDate = Boolean(row.endDate && row.endDate !== row.date)
    // Previously an end date without an end time was silently dropped.
    if (hasEndDate && !row.endTime) throw new Error("Uz datum završetka unesite i vrijeme završetka ili uklonite završetak.")
    if (!hasEndDate && row.endTime && row.endTime === row.startTime) throw new Error("Vrijeme završetka ne može biti jednako početku.")
    const endDate = hasEndDate ? row.endDate! : row.endTime && row.endTime < row.startTime ? nextDate(row.date) : row.date
    return {
      ...(row.id ? { id: row.id } : {}),
      startsAt: zagrebLocalToIso(row.date, row.startTime),
      // null (not undefined) so a cleared end survives JSON.stringify and the
      // API clears the stored value instead of keeping it.
      endsAt: row.endTime ? zagrebLocalToIso(endDate, row.endTime) : null,
      isAllDay: false,
    }
  })
}
