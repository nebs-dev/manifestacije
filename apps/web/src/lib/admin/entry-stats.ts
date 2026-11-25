/** Shapes returned by `GET /api/admin/stats/entries` and `/day`, plus the
 *  formatting the statistics page shares with its tests. */

export type EntryRange = { from: string; to: string }

export type UserEntryStats = {
  userId: number
  name: string
  role: string
  organizerName: string | null
  total: number
  today: number
  thisWeek: number
  thisMonth: number
  activeDays: number
  averagePerActiveDay: number
  lastEntryAt: string | null
  sharePercent: number
}

export type EntryStats = {
  range: EntryRange
  totals: {
    total: number
    admin: number
    organizer: number
    unknown: number
    today: number
    yesterday: number
    thisWeek: number
    thisMonth: number
    averagePerDay: number
    published: number
    deleted: number
    previousTotal: number
    previousRange: EntryRange
  }
  users: UserEntryStats[]
  daily: { date: string; total: number; byUser: Record<number, number> }[]
}

export type EntryTimeline = {
  date: string
  userId: number | null
  entries: { id: number; title: string; createdAt: string; status?: string; slug?: string }[]
  firstAt: string | null
  lastAt: string | null
  gapsMinutes: number[]
  averageGapMinutes: number | null
  medianGapMinutes: number | null
  shortestGapMinutes: number | null
  longestGapMinutes: number | null
  excludedGaps: number
  spanMinutes: number | null
  perHour: Record<number, number>
}

export type EntryPreset =
  | "today" | "yesterday" | "this-week" | "last-week" | "last-7"
  | "this-month" | "last-month" | "last-30" | "this-year" | "all-time"

export const PRESET_LABELS: { value: EntryPreset; label: string }[] = [
  { value: "today", label: "Danas" },
  { value: "yesterday", label: "Jučer" },
  { value: "this-week", label: "Ovaj tjedan" },
  { value: "last-week", label: "Prošli tjedan" },
  { value: "last-7", label: "Posljednjih 7 dana" },
  { value: "this-month", label: "Ovaj mjesec" },
  { value: "last-month", label: "Prošli mjesec" },
  { value: "last-30", label: "Posljednjih 30 dana" },
  { value: "this-year", label: "Ova godina" },
  { value: "all-time", label: "Sve vrijeme" },
]

export const ZAGREB = "Europe/Zagreb"

const dateFormat = new Intl.DateTimeFormat("hr-HR", { timeZone: ZAGREB, day: "2-digit", month: "2-digit", year: "numeric" })
const timeFormat = new Intl.DateTimeFormat("hr-HR", { timeZone: ZAGREB, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
/** Seconds are part of the request: two entries a minute apart are a
 *  different story from two entries ten seconds apart. */
const secondsFormat = new Intl.DateTimeFormat("hr-HR", { timeZone: ZAGREB, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
const weekdayFormat = new Intl.DateTimeFormat("hr-HR", { timeZone: ZAGREB, weekday: "short" })

export const formatDay = (dateKey: string) => dateFormat.format(new Date(`${dateKey}T12:00:00Z`))
export const formatWeekday = (dateKey: string) => weekdayFormat.format(new Date(`${dateKey}T12:00:00Z`)).replace(".", "")
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))
export const formatTimeWithSeconds = (iso: string) => secondsFormat.format(new Date(iso))
export const formatDateTime = (iso: string) => `${dateFormat.format(new Date(iso))} ${timeFormat.format(new Date(iso))}`

/** The weekend reads differently from a Tuesday, so the table marks it. */
export const isWeekend = (dateKey: string) => {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6
}

/** "2 h 05 min" rather than "125 min": gaps are read, not computed with. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—"
  if (minutes < 1) return `${Math.round(minutes * 60)} s`
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(Math.round(minutes % 60)).padStart(2, "0")} min`
}

/** Change against the previous comparable period. Growth from nothing has no
 *  percentage — reporting one would be inventing a denominator. */
export function compareWithPrevious(total: number, previousTotal: number): { delta: number; percent: number | null } {
  const delta = total - previousTotal
  return { delta, percent: previousTotal === 0 ? null : Math.round((delta / previousTotal) * 1000) / 10 }
}

/** Heat buckets 0…4 for the calendar. Relative to the busiest day of the
 *  month, so a quiet month still shows its own shape; a day with entries is
 *  never bucket 0, which is reserved for "nothing happened". */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const share = count / max
  if (share > 0.75) return 4
  if (share > 0.5) return 3
  if (share > 0.25) return 2
  return 1
}

/** Monday-first calendar grid for a month: leading nulls pad the first week. */
export function calendarGrid(days: string[]): (string | null)[] {
  if (!days.length) return []
  const first = new Date(`${days[0]}T12:00:00Z`).getUTCDay()
  const padding = (first + 6) % 7
  return [...Array<null>(padding).fill(null), ...days]
}

export const addMonths = (month: string, delta: number): string => {
  const [year, index] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, index - 1 + delta, 1, 12))
  return date.toISOString().slice(0, 7)
}

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("hr-HR", { timeZone: ZAGREB, month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`))

/** Which gaps are long enough to be worth looking at, given the cap the
 *  editor chose. With no cap nothing is marked — there is no threshold. */
export const isLongGap = (minutes: number, cap: number | null) => cap !== null && minutes > cap

export type EntryTrends = {
  months: { month: string; total: number; byUser: Record<number, number> }[]
  weekdays: { weekday: number; total: number }[]
  hours: { hour: number; total: number }[]
  monthToDate: { month: string; total: number; previousMonth: string; previousTotal: number; throughDay: number }
}

export type ContentStats = {
  range: EntryRange
  byCity: { id: number | null; name: string; total: number }[]
  byCounty: { id: number | null; name: string; total: number }[]
  byCategory: { id: number | null; name: string; total: number }[]
  published: number
  unpublished: number
  upcoming: number
  enteredOnEventDay: number
  averageLeadDays: number | null
  medianLeadDays: number | null
  pendingDuplicates: number
  incomplete: {
    total: number
    withoutImage: number
    withoutLocation: number
    withoutDescription: number
    items: { id: number; title: string; missing: string[] }[]
  }
}

export const WEEKDAY_NAMES = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"]

/** Bar height as a share of the tallest bar, so an empty series does not
 *  divide by zero and a single value does not fill the whole chart. */
export const barHeight = (value: number, max: number): number =>
  max <= 0 ? 0 : Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100))

/** The statistics tables, as rows ready for `toCsv`. */
export function statsCsvRows(stats: EntryStats): (string | number | null)[][] {
  const admins = stats.users.filter(user => user.total > 0)
  return [
    ["Razdoblje", stats.range.from, stats.range.to],
    [],
    ["Korisnik", "Uloga", "Ukupno", "Aktivnih dana", "Prosjek po aktivnom danu", "Udio %", "Posljednji unos"],
    ...admins.map(user => [user.name, user.role, user.total, user.activeDays, user.averagePerActiveDay, user.sharePercent,
      user.lastEntryAt ? formatDateTime(user.lastEntryAt) : ""]),
    [],
    ["Datum", ...admins.map(user => user.name), "Ukupno"],
    ...stats.daily.map(day => [formatDay(day.date), ...admins.map(user => day.byUser[user.userId] ?? 0), day.total]),
    [],
    ["Ukupno", stats.totals.total],
    ["Administratori", stats.totals.admin],
    ["Organizatori", stats.totals.organizer],
    ["Nepoznat autor", stats.totals.unknown],
    ["Objavljeno", stats.totals.published],
    ["Obrisano (evidentirano)", stats.totals.deleted],
    ["Prethodno razdoblje", stats.totals.previousTotal],
  ]
}
