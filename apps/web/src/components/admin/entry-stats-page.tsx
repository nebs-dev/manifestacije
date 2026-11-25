"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { authedFetch } from "@/lib/admin/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  addMonths, barHeight, calendarGrid, compareWithPrevious, formatDateTime, formatDay, formatMinutes, formatTimeWithSeconds,
  formatWeekday, heatLevel, isLongGap, isWeekend, monthLabel, PRESET_LABELS, statsCsvRows, WEEKDAY_NAMES,
  type ContentStats, type EntryPreset, type EntryStats, type EntryTimeline, type EntryTrends, type UserEntryStats,
} from "@/lib/admin/entry-stats"
import { downloadCsv, toCsv } from "@/lib/admin/csv"

/** What the page is currently showing: a named period, a whole month (the
 *  arrows step through these), or dates the editor typed. */
type Selection =
  | { kind: "preset"; preset: EntryPreset }
  | { kind: "month"; month: string }
  | { kind: "custom"; from: string; to: string }

const GAP_CAPS: { value: number | null; label: string }[] = [
  { value: null, label: "Bez ograničenja" },
  { value: 15, label: "Bez pauza > 15 min" },
  { value: 30, label: "Bez pauza > 30 min" },
  { value: 60, label: "Bez pauza > 60 min" },
]

const HEAT_CLASSES = ["bg-muted/40", "bg-primary/20", "bg-primary/40", "bg-primary/65", "bg-primary/90 text-primary-foreground"]

function selectionParams(selection: Selection): string {
  const params = new URLSearchParams()
  if (selection.kind === "preset") params.set("preset", selection.preset)
  if (selection.kind === "month") params.set("month", selection.month)
  if (selection.kind === "custom") { params.set("from", selection.from); params.set("to", selection.to) }
  return params.toString()
}

/** The month the calendar should draw: the one selected, or the one the
 *  range starts in. */
const monthOf = (selection: Selection, stats: EntryStats | null): string =>
  selection.kind === "month" ? selection.month : (stats?.daily[0]?.date ?? new Date().toISOString().slice(0, 10)).slice(0, 7)

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/**
 * Entry statistics (STAT-01…STAT-07). Opens on the current month so the
 * question "who entered how much, and when" is answered without anyone
 * picking a date first.
 *
 * Every number is a link: a day, an author or a cell opens the events behind
 * it. Nothing here is a record of hours worked — it is the pace of data
 * entry, and the page says so where it could be misread.
 */
export function EntryStatsPage() {
  const [selection, setSelection] = useState<Selection>({ kind: "preset", preset: "this-month" })
  const [custom, setCustom] = useState({ from: "", to: "" })
  const [stats, setStats] = useState<EntryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [focusUserId, setFocusUserId] = useState<number | null>(null)
  const [day, setDay] = useState<{ date: string; userId: number | null } | null>(null)
  const [timeline, setTimeline] = useState<EntryTimeline | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [gapCap, setGapCap] = useState<number | null>(null)
  const [trends, setTrends] = useState<EntryTrends | null>(null)
  const [content, setContent] = useState<ContentStats | null>(null)

  const params = selectionParams(selection)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError("")
    authedFetch(`/api/admin/stats/entries?${params}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error()
        const data = (await response.json()) as EntryStats
        if (!controller.signal.aborted) setStats(data)
      })
      .catch(() => { if (!controller.signal.aborted) setError("Statistiku nije moguće učitati. Pokušajte ponovno.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [params])

  // Trends read a year of timestamps and the content statistics read every
  // event of the period, so both are fetched beside the main call rather than
  // holding up the numbers at the top of the page.
  useEffect(() => {
    const controller = new AbortController()
    authedFetch("/api/admin/stats/trends?months=12", { signal: controller.signal })
      .then(async response => { if (response.ok && !controller.signal.aborted) setTrends((await response.json()) as EntryTrends) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    authedFetch(`/api/admin/stats/content?${params}`, { signal: controller.signal })
      .then(async response => { if (response.ok && !controller.signal.aborted) setContent((await response.json()) as ContentStats) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [params])

  useEffect(() => {
    if (!day) { setTimeline(null); return }
    const controller = new AbortController()
    const query = new URLSearchParams({ date: day.date })
    if (day.userId !== null) query.set("userId", String(day.userId))
    if (gapCap !== null) query.set("gapCapMinutes", String(gapCap))
    setTimelineLoading(true)
    authedFetch(`/api/admin/stats/entries/day?${query}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error()
        const data = (await response.json()) as EntryTimeline
        if (!controller.signal.aborted) setTimeline(data)
      })
      .catch(() => { if (!controller.signal.aborted) setTimeline(null) })
      .finally(() => { if (!controller.signal.aborted) setTimelineLoading(false) })
    return () => controller.abort()
  }, [day, gapCap])

  const rangeDays = useMemo(() => (stats?.daily ?? []).map(entry => entry.date), [stats])
  const firstDay = rangeDays[0] ?? ""
  const lastDay = rangeDays.at(-1) ?? ""
  /** Links back into the events list carry the same period (STAT-10). */
  const eventsHref = useCallback((userId?: number, date?: string) => {
    const query = new URLSearchParams()
    if (userId !== undefined) query.set("createdByUserId", String(userId))
    query.set("createdFrom", date ?? firstDay)
    query.set("createdTo", date ?? lastDay)
    return `/admin/events?${query}`
  }, [firstDay, lastDay])

  const admins = (stats?.users ?? []).filter(user => user.role === "ADMIN")
  const organizers = (stats?.users ?? []).filter(user => user.role === "ORGANIZER")
  const visible = (users: UserEntryStats[]) => showInactive ? users : users.filter(user => user.total > 0)
  const matrixUsers = focusUserId === null ? visible(admins) : admins.filter(user => user.userId === focusUserId)
  const month = monthOf(selection, stats)
  const monthDays = rangeDays.filter(date => date.startsWith(month))
  const heatSource = focusUserId === null
    ? (stats?.daily ?? [])
    : (stats?.daily ?? []).map(entry => ({ ...entry, total: entry.byUser[focusUserId] ?? 0 }))
  const heatByDay = new Map(heatSource.map(entry => [entry.date, entry.total]))
  const heatMax = Math.max(0, ...monthDays.map(date => heatByDay.get(date) ?? 0))
  const comparison = stats ? compareWithPrevious(stats.totals.total, stats.totals.previousTotal) : null

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Statistika unosa</h1>
        <p className="text-muted-foreground">
          Tko je, kada i koliko događaja unio. Prikazuje se dinamika unosa — ne radno vrijeme administratora.
        </p>
      </header>

      <section aria-label="Razdoblje" className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <div className="flex flex-wrap gap-2">
          {PRESET_LABELS.map(preset => (
            <Button
              key={preset.value}
              type="button"
              size="sm"
              variant={selection.kind === "preset" && selection.preset === preset.value ? "default" : "outline"}
              onClick={() => { setSelection({ kind: "preset", preset: preset.value }); setDay(null) }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="outline" aria-label="Prethodni mjesec"
              onClick={() => { setSelection({ kind: "month", month: addMonths(month, -1) }); setDay(null) }}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-medium">{monthLabel(month)}</span>
            <Button type="button" size="sm" variant="outline" aria-label="Sljedeći mjesec"
              onClick={() => { setSelection({ kind: "month", month: addMonths(month, 1) }); setDay(null) }}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="stats-from" className="text-xs text-muted-foreground">Od</Label>
              <Input id="stats-from" type="date" value={custom.from} className="w-40"
                onChange={event => setCustom(current => ({ ...current, from: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="stats-to" className="text-xs text-muted-foreground">Do</Label>
              <Input id="stats-to" type="date" value={custom.to} className="w-40"
                onChange={event => setCustom(current => ({ ...current, to: event.target.value }))} />
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!custom.from || !custom.to}
              onClick={() => { setSelection({ kind: "custom", from: custom.from, to: custom.to }); setDay(null) }}>
              Prikaži razdoblje
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!stats}
              onClick={() => stats && downloadCsv(`statistika-unosa-${firstDay}_${lastDay}.csv`, toCsv(statsCsvRows(stats)))}>
              Izvoz (CSV)
            </Button>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="text-destructive">{error}</p>}
      {loading && !stats && <p>Učitavanje…</p>}

      {stats && (
        <>
          <section aria-label="Sažetak" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Card label="Ukupno u razdoblju" value={String(stats.totals.total)}
              hint={`${formatDay(firstDay)} – ${formatDay(lastDay)}`} />
            <Card label="Unosi administratora" value={String(stats.totals.admin)} />
            <Card label="Unosi organizatora" value={String(stats.totals.organizer)} />
            <Card label="Danas" value={String(stats.totals.today)} />
            <Card label="Jučer" value={String(stats.totals.yesterday)} />
            <Card label="Ovaj tjedan" value={String(stats.totals.thisWeek)} />
            <Card label="Ovaj mjesec" value={String(stats.totals.thisMonth)} />
            <Card label="Prosječno dnevno" value={String(stats.totals.averagePerDay)} hint="po danu u razdoblju" />
            <Card
              label="Prethodno razdoblje"
              value={`${comparison && comparison.delta >= 0 ? "+" : ""}${comparison?.delta ?? 0}`}
              hint={comparison?.percent === null
                ? `prije: ${stats.totals.previousTotal} — postotak nije primjenjiv`
                : `prije: ${stats.totals.previousTotal} (${comparison!.percent > 0 ? "+" : ""}${comparison!.percent}%)`}
            />
            <Card label="Objavljeno u razdoblju" value={String(stats.totals.published)} hint="po datumu objave" />
            <Card label="Obrisano u razdoblju" value={String(stats.totals.deleted)} hint="evidentira se od 25.11.2026." />
            {stats.totals.unknown > 0 && (
              <Card label="Nepoznat autor" value={String(stats.totals.unknown)} hint="unosi bez zabilježenog autora" />
            )}
          </section>

          <section aria-label="Pregled po administratorima" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">Administratori</h2>
              <div className="flex items-center gap-3">
                {focusUserId !== null && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setFocusUserId(null)}>Prikaži sve</Button>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={showInactive} onChange={() => setShowInactive(value => !value)}
                    className="size-4 rounded border-border accent-primary" />
                  Prikaži račune bez aktivnosti
                </label>
              </div>
            </div>
            <UserTable users={visible(admins)} focusUserId={focusUserId} onFocus={setFocusUserId} eventsHref={eventsHref} />
          </section>

          <section aria-label="Pregled po organizatorima" className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">Organizatori</h2>
            {visible(organizers).length
              ? <UserTable users={visible(organizers)} focusUserId={focusUserId} onFocus={setFocusUserId} eventsHref={eventsHref} />
              : <p className="text-sm text-muted-foreground">Nema organizatorskih unosa u ovom razdoblju.</p>}
          </section>

          <section aria-label="Dnevna statistika" className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">Dnevni unosi</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Datum</th>
                    {matrixUsers.map(user => <th key={user.userId} scope="col" className="px-3 py-2 text-right font-medium">{user.name}</th>)}
                    <th scope="col" className="px-3 py-2 text-right font-medium">Ukupno</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.daily.map(entry => (
                    <tr key={entry.date} className={cn("border-t border-border", isWeekend(entry.date) && "bg-muted/30")}>
                      <th scope="row" className="px-3 py-1.5 text-left font-normal">
                        <button type="button" className="cursor-pointer hover:underline"
                          onClick={() => setDay({ date: entry.date, userId: focusUserId })}>
                          {formatDay(entry.date)} <span className="text-muted-foreground">{formatWeekday(entry.date)}</span>
                        </button>
                      </th>
                      {matrixUsers.map(user => {
                        const count = entry.byUser[user.userId] ?? 0
                        return (
                          <td key={user.userId} className="px-3 py-1.5 text-right tabular-nums">
                            {count === 0 ? <span className="text-muted-foreground">0</span> : (
                              <button type="button" className="cursor-pointer font-medium hover:underline"
                                onClick={() => setDay({ date: entry.date, userId: user.userId })}>
                                {count}
                              </button>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">{entry.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/40">
                  <tr>
                    <th scope="row" className="px-3 py-2 text-left">Ukupno</th>
                    {matrixUsers.map(user => (
                      <td key={user.userId} className="px-3 py-2 text-right font-semibold tabular-nums">{user.total}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{stats.totals.total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section aria-label="Kalendar aktivnosti" className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">Kalendar aktivnosti — {monthLabel(month)}</h2>
            <div className="grid grid-cols-7 gap-1 rounded-lg border border-border p-3">
              {["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"].map(name => (
                <div key={name} className="pb-1 text-center text-xs text-muted-foreground">{name}</div>
              ))}
              {calendarGrid(monthDays).map((date, index) => date === null
                ? <div key={`pad-${index}`} />
                : (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setDay({ date, userId: focusUserId })}
                    aria-label={`${formatDay(date)}: ${heatByDay.get(date) ?? 0} unosa`}
                    className={cn("flex cursor-pointer flex-col items-center rounded-md p-2 text-xs transition-colors hover:ring-2 hover:ring-ring",
                      HEAT_CLASSES[heatLevel(heatByDay.get(date) ?? 0, heatMax)])}
                  >
                    <span>{Number(date.slice(8))}</span>
                    <span className="font-semibold tabular-nums">{heatByDay.get(date) ?? 0}</span>
                  </button>
                ))}
            </div>
          </section>

          {trends && (
            <section aria-label="Trendovi" className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold">Trendovi</h2>
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  Unosi po mjesecima (12 mjeseci). Tekući mjesec do {trends.monthToDate.throughDay}. dana:{" "}
                  <strong>{trends.monthToDate.total}</strong> naspram <strong>{trends.monthToDate.previousTotal}</strong> u istom
                  dijelu mjeseca {monthLabel(trends.monthToDate.previousMonth)}.
                </p>
                <Chart
                  bars={trends.months.map(month => ({ key: month.month, label: month.month.slice(5), value: month.total,
                    title: `${monthLabel(month.month)}: ${month.total}` }))}
                  onPick={month => { setSelection({ kind: "month", month }); setDay(null) }}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm text-muted-foreground">Po danima u tjednu (12 mjeseci)</p>
                  <Chart bars={trends.weekdays.map(day => ({ key: String(day.weekday), label: WEEKDAY_NAMES[day.weekday], value: day.total,
                    title: `${WEEKDAY_NAMES[day.weekday]}: ${day.total}` }))} />
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm text-muted-foreground">Po satima u danu (Europe/Zagreb)</p>
                  <Chart bars={trends.hours.map(hour => ({ key: String(hour.hour), label: String(hour.hour).padStart(2, "0"), value: hour.total,
                    title: `${String(hour.hour).padStart(2, "0")}:00 — ${hour.total}` }))} compact />
                </div>
              </div>
            </section>
          )}

          {content && (
            <section aria-label="Statistika sadržaja" className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-semibold">Sadržaj portala u razdoblju</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Card label="Objavljeno" value={String(content.published)} />
                <Card label="Neobjavljeno" value={String(content.unpublished)} />
                <Card label="Nadolazeći" value={String(content.upcoming)} />
                <Card label="Uneseno na dan održavanja" value={String(content.enteredOnEventDay)} />
                <Card label="Najava unaprijed" value={content.medianLeadDays === null ? "—" : `${content.medianLeadDays} d`}
                  hint={content.averageLeadDays === null ? undefined : `prosjek ${content.averageLeadDays} d`} />
                <Card label="Mogući duplikati" value={String(content.pendingDuplicates)} hint="neriješeni" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Breakdown title="Gradovi" rows={content.byCity} />
                <Breakdown title="Županije" rows={content.byCounty} />
                <Breakdown title="Kategorije" rows={content.byCategory} />
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm">
                  Nepotpun sadržaj: <strong>{content.incomplete.total}</strong>
                  <span className="text-muted-foreground">
                    {" "}(bez slike {content.incomplete.withoutImage}, bez lokacije {content.incomplete.withoutLocation},
                    bez opisa {content.incomplete.withoutDescription})
                  </span>
                </p>
                {content.incomplete.items.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {content.incomplete.items.map(item => (
                      <li key={item.id} className="flex flex-wrap items-baseline gap-2">
                        <Link href={`/admin/events/${item.id}`} className="hover:underline">{item.title}</Link>
                        <span className="text-xs text-muted-foreground">nedostaje: {item.missing.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {day && (
            <section aria-label="Detalji dana" className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold">
                  {formatDay(day.date)}
                  {day.userId !== null && ` · ${stats.users.find(user => user.userId === day.userId)?.name ?? `Korisnik #${day.userId}`}`}
                </h2>
                <div className="flex items-center gap-2">
                  <Label htmlFor="gap-cap" className="text-xs text-muted-foreground">Prosjek razmaka</Label>
                  <select id="gap-cap" value={gapCap === null ? "" : String(gapCap)}
                    onChange={event => setGapCap(event.target.value === "" ? null : Number(event.target.value))}
                    className="rounded-md border border-input bg-card px-2 py-1 text-sm">
                    {GAP_CAPS.map(cap => <option key={cap.label} value={cap.value === null ? "" : String(cap.value)}>{cap.label}</option>)}
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDay(null)}>Zatvori</Button>
                </div>
              </div>
              {timelineLoading && !timeline ? <p>Učitavanje…</p> : timeline && (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                    <Card label="Unosa" value={String(timeline.entries.length)} />
                    <Card label="Prvi unos" value={timeline.firstAt ? formatTimeWithSeconds(timeline.firstAt) : "—"} />
                    <Card label="Posljednji unos" value={timeline.lastAt ? formatTimeWithSeconds(timeline.lastAt) : "—"} />
                    <Card label="Raspon" value={formatMinutes(timeline.spanMinutes)} />
                    <Card label="Prosječan razmak" value={formatMinutes(timeline.averageGapMinutes)}
                      hint={timeline.excludedGaps ? `bez ${timeline.excludedGaps} dužih pauza` : undefined} />
                    <Card label="Medijan razmaka" value={formatMinutes(timeline.medianGapMinutes)} />
                    <Card label="Najkraći / najduži" value={`${formatMinutes(timeline.shortestGapMinutes)} / ${formatMinutes(timeline.longestGapMinutes)}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Razmaci opisuju dinamiku unosa, ne radno vrijeme.
                  </p>
                  <ol className="flex flex-col gap-1">
                    {timeline.entries.map((entry, index) => {
                      const gap = index === 0 ? null : timeline.gapsMinutes[index - 1]
                      return (
                        <li key={entry.id} className="flex flex-wrap items-baseline gap-2 border-t border-border py-1.5 text-sm first:border-t-0">
                          <span className="tabular-nums text-muted-foreground">{formatTimeWithSeconds(entry.createdAt)}</span>
                          <Link href={`/admin/events/${entry.id}`} className="font-medium hover:underline">{entry.title}</Link>
                          {entry.status && <span className="text-xs text-muted-foreground">{entry.status}</span>}
                          {gap !== null && (
                            <span className={cn("ml-auto text-xs tabular-nums",
                              isLongGap(gap, gapCap) ? "rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                              +{formatMinutes(gap)}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                  {timeline.entries.length === 0 && <p className="text-sm text-muted-foreground">Toga dana nema unosa.</p>}
                  <div>
                    <Link href={eventsHref(day.userId ?? undefined, day.date)} className="text-sm text-primary hover:underline">
                      Otvori popis događaja za ovaj dan →
                    </Link>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Chart({ bars, compact, onPick }: {
  bars: { key: string; label: string; value: number; title: string }[]
  compact?: boolean
  onPick?: (key: string) => void
}) {
  const max = Math.max(0, ...bars.map(bar => bar.value))
  return (
    <div className="flex items-end gap-1" style={{ height: compact ? 80 : 120 }}>
      {bars.map(bar => (
        <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-muted-foreground">{bar.value || ""}</span>
          {onPick ? (
            <button type="button" title={bar.title} aria-label={bar.title} onClick={() => onPick(bar.key)}
              className="w-full cursor-pointer rounded-t bg-primary/70 hover:bg-primary"
              style={{ height: `${barHeight(bar.value, max)}%` }} />
          ) : (
            <div title={bar.title} aria-label={bar.title} className="w-full rounded-t bg-primary/70"
              style={{ height: `${barHeight(bar.value, max)}%` }} />
          )}
          <span className="truncate text-[10px] text-muted-foreground">{bar.label}</span>
        </div>
      ))}
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: { id: number | null; name: string; total: number }[] }) {
  const shown = rows.slice(0, 8)
  const rest = rows.slice(8).reduce((sum, row) => sum + row.total, 0)
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {shown.length === 0 ? <p className="text-sm text-muted-foreground">Nema podataka.</p> : (
        <ul className="flex flex-col gap-1 text-sm">
          {shown.map(row => (
            <li key={`${row.id ?? "none"}-${row.name}`} className="flex items-baseline justify-between gap-2">
              <span className="truncate">{row.name}</span>
              <span className="tabular-nums">{row.total}</span>
            </li>
          ))}
          {rest > 0 && (
            <li className="flex items-baseline justify-between gap-2 text-muted-foreground">
              <span>Ostalo</span><span className="tabular-nums">{rest}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function UserTable({ users, focusUserId, onFocus, eventsHref }: {
  users: UserEntryStats[]
  focusUserId: number | null
  onFocus: (id: number | null) => void
  eventsHref: (userId?: number, date?: string) => string
}) {
  if (!users.length) return <p className="text-sm text-muted-foreground">Nema aktivnih računa u ovom razdoblju.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Korisnik</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Ukupno</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Danas</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Tjedan</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Mjesec</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Aktivnih dana</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Prosjek / dan</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Udio</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Posljednji unos</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.userId} className={cn("border-t border-border", focusUserId === user.userId && "bg-primary/5")}>
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                <button type="button" className="cursor-pointer font-medium hover:underline"
                  aria-pressed={focusUserId === user.userId}
                  onClick={() => onFocus(focusUserId === user.userId ? null : user.userId)}>
                  {user.name}
                </button>
                {user.organizerName && <span className="ml-2 text-xs text-muted-foreground">{user.organizerName}</span>}
              </th>
              <td className="px-3 py-1.5 text-right tabular-nums">
                <Link href={eventsHref(user.userId)} className="font-medium hover:underline">{user.total}</Link>
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{user.today}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{user.thisWeek}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{user.thisMonth}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{user.activeDays}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{user.averagePerActiveDay}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{user.sharePercent}%</td>
              <td className="px-3 py-1.5 text-left tabular-nums text-muted-foreground">
                {user.lastEntryAt ? formatDateTime(user.lastEntryAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
