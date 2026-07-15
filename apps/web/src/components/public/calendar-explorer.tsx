"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, SlidersHorizontal, X } from "lucide-react"
import {
  buildMonthGrid,
  type CroEvent,
  dateKey,
  dateParts,
  eventOccursOn,
  MONTHS_HR_LONG,
  MONTHS_HR_NOM,
  WEEKDAY_SHORT_HR,
} from "@/lib/data"
import { cn } from "@/lib/utils"
import { CategoryBadge, PriceBadge } from "./badges"
import { EventFilters } from "./event-filters"
import { EventPoster } from "./event-poster"

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const off = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - off)
  return x
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function weekdayShort(d: Date) {
  return WEEKDAY_SHORT_HR[(d.getDay() + 6) % 7]
}

type View = "mjesec" | "tjedan"

export function CalendarExplorer({
  events,
  initialYear,
  initialMonth,
}: {
  events: CroEvent[]
  initialYear: number
  initialMonth: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])
  const todayKey = dateKey(today)

  const [view, setView] = useState<View>("mjesec")
  const [anchor, setAnchor] = useState<Date>(() => new Date(initialYear, initialMonth, 1))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const thisSaturday = useMemo(() => {
    const md = (today.getDay() + 6) % 7
    return addDays(today, (5 - md + 7) % 7)
  }, [today])

  const visibleDays = useMemo(() => {
    if (view === "tjedan") {
      const s = startOfWeek(anchor)
      return Array.from({ length: 7 }, (_, i) => addDays(s, i))
    }
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
    return Array.from({ length: last }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1))
  }, [view, anchor])

  const groups = useMemo(() => {
    const m: Record<string, CroEvent[]> = {}
    for (const day of visibleDays) {
      const list = events.filter((e) => eventOccursOn(e, day)).sort((a, b) => a.time.localeCompare(b.time))
      if (list.length) m[dateKey(day)] = list
    }
    return m
  }, [visibleDays, events])

  const daySections = visibleDays.filter((d) => groups[dateKey(d)])
  const totalVisible = daySections.reduce((n, d) => n + groups[dateKey(d)].length, 0)

  useEffect(() => {
    if (!selectedDay) return
    const el = document.getElementById(`day-${selectedDay}`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [selectedDay, view, anchor])

  const goPrev = () => setAnchor((a) => (view === "tjedan" ? addDays(a, -7) : new Date(a.getFullYear(), a.getMonth() - 1, 1)))
  const goNext = () => setAnchor((a) => (view === "tjedan" ? addDays(a, 7) : new Date(a.getFullYear(), a.getMonth() + 1, 1)))

  function preset(kind: "danas" | "vikend" | "mjesec") {
    if (kind === "mjesec") {
      setView("mjesec")
      setAnchor(firstOfMonth(today))
      setSelectedDay(null)
      return
    }
    setView("tjedan")
    if (kind === "danas") {
      setAnchor(today)
      setSelectedDay(todayKey)
    } else {
      setAnchor(thisSaturday)
      setSelectedDay(dateKey(thisSaturday))
    }
  }

  const presetActive = {
    danas: view === "tjedan" && selectedDay === todayKey,
    vikend: view === "tjedan" && selectedDay === dateKey(thisSaturday),
    mjesec: view === "mjesec" && sameMonth(anchor, today),
  }

  function toggleParam(key: string) {
    const checked = params.get(key) === "1"
    const next = new URLSearchParams(params.toString())
    if (checked) next.delete(key)
    else next.set(key, "1")
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const heading =
    view === "mjesec"
      ? `${MONTHS_HR_NOM[anchor.getMonth()]} ${anchor.getFullYear()}`
      : (() => {
          const s = startOfWeek(anchor)
          const e = addDays(s, 6)
          return sameMonth(s, e)
            ? `${s.getDate()}. - ${e.getDate()}. ${MONTHS_HR_LONG[s.getMonth()]}`
            : `${s.getDate()}. ${MONTHS_HR_LONG[s.getMonth()]} - ${e.getDate()}. ${MONTHS_HR_LONG[e.getMonth()]}`
        })()

  const miniGrid = useMemo(() => buildMonthGrid(anchor.getFullYear(), anchor.getMonth()), [anchor])
  const selectFromMini = (date: Date) => {
    setAnchor(date)
    setSelectedDay(dateKey(date))
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-8 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-6">
          <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
            <EventFilters />
          </div>
          <MiniMonth
            grid={miniGrid}
            label={`${MONTHS_HR_NOM[anchor.getMonth()]} ${anchor.getFullYear()}`}
            events={events}
            todayKey={todayKey}
            selectedDay={selectedDay}
            onPrev={() => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1))}
            onNext={() => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1))}
            onSelect={selectFromMini}
          />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} aria-label="Prethodni prikaz" className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <h2 className="min-w-44 font-heading text-2xl font-semibold md:text-3xl">{heading}</h2>
            <button onClick={goNext} aria-label="Sljedeci prikaz" className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted">
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>

          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {(["mjesec", "tjedan"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => setFiltersOpen(true)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-poster lg:hidden">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtri
        </button>

        <div className="no-scrollbar mb-5 max-w-full overflow-x-auto">
          <div className="flex w-max items-center gap-2 pr-4 md:w-auto md:flex-wrap md:pr-0">
            <Chip active={presetActive.danas} onClick={() => preset("danas")}>Danas</Chip>
            <Chip active={presetActive.vikend} onClick={() => preset("vikend")}>Ovaj vikend</Chip>
            <Chip active={presetActive.mjesec} onClick={() => preset("mjesec")}>Ovaj mjesec</Chip>
            <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
            <Chip tone="accent" active={params.get("besplatno") === "1"} onClick={() => toggleParam("besplatno")}>Besplatno</Chip>
            <Chip tone="accent" active={params.get("djeca") === "1"} onClick={() => toggleParam("djeca")}>Za djecu</Chip>
            <Chip tone="accent" active={params.get("vani") === "1"} onClick={() => toggleParam("vani")}>Na otvorenom</Chip>
          </div>
        </div>

        <div className={cn("mb-8 max-w-full", view === "tjedan" && "no-scrollbar overflow-x-auto")}>
          <div className={cn("flex gap-2 pr-4", view === "mjesec" ? "flex-wrap" : "w-max")}>
            {visibleDays.map((d) => {
              const key = dateKey(d)
              const count = groups[key]?.length ?? 0
              const isSelected = key === selectedDay
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(count ? key : null)}
                  className={cn(
                    "flex w-12 shrink-0 flex-col items-center gap-1 rounded-2xl border py-2.5 transition-colors",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/30",
                    !count && "opacity-60",
                  )}
                >
                  <span className={cn("text-[0.65rem] font-medium uppercase", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>{weekdayShort(d)}</span>
                  <span className="font-heading text-lg font-semibold leading-none">{d.getDate()}</span>
                  <span className={cn("size-1.5 rounded-full", count ? (isSelected ? "bg-primary-foreground" : "bg-accent") : "bg-transparent")} aria-hidden />
                </button>
              )
            })}
          </div>
        </div>

        {daySections.length ? (
          <div className="flex flex-col gap-10">
            <p className="text-sm text-muted-foreground">{totalVisible} termina u ovom prikazu</p>
            {daySections.map((d) => {
              const key = dateKey(d)
              const dp = dateParts(key)
              const list = groups[key]
              const isToday = key === todayKey
              return (
                <section key={key} id={`day-${key}`} className="min-w-0 scroll-mt-24">
                  <div className="mb-4 flex items-end gap-3">
                    <div className={cn("flex size-14 flex-col items-center justify-center rounded-2xl shadow-poster", isToday ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground")}>
                      <span className="font-heading text-2xl font-bold leading-none">{dp.day}</span>
                      <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wider">{dp.month}</span>
                    </div>
                    <div>
                      <p className="font-heading text-lg font-semibold leading-tight">{dp.weekday}{isToday && <span className="ml-2 text-sm font-medium text-accent-foreground">Danas</span>}</p>
                      <p className="text-sm text-muted-foreground">{dp.day}. {dp.monthLong} {dp.year}.</p>
                    </div>
                    <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{list.length} termina</span>
                  </div>
                  <ul className="flex min-w-0 flex-col gap-3">{list.map((e) => <AgendaRow key={e.slug} event={e} />)}</ul>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
            <p className="font-heading text-lg font-semibold">Nema termina u ovom prikazu</p>
            <p className="mt-1 text-sm text-muted-foreground">Pokušaj s drugim mjesecom ili ublaži filtre.</p>
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink/50 backdrop-blur-sm" aria-label="Zatvori filtre" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-background shadow-poster-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="font-heading text-lg font-semibold">Filtri</span>
              <button onClick={() => setFiltersOpen(false)} aria-label="Zatvori" className="rounded-full p-1 hover:bg-muted">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6"><EventFilters /></div>
            <div className="border-t border-border p-4">
              <button onClick={() => setFiltersOpen(false)} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">Prikazi rezultate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, tone = "primary", children }: { active: boolean; onClick: () => void; tone?: "primary" | "accent"; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? tone === "accent"
            ? "border-accent bg-accent text-accent-foreground"
            : "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  )
}

function AgendaRow({ event }: { event: CroEvent }) {
  const multiDay = event.endDate && event.endDate !== event.date
  return (
    <li>
      <Link href={`/eventi/${event.slug}`} className="group grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-4 rounded-2xl border border-border/70 bg-card p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-poster sm:grid-cols-[6rem_minmax(0,1fr)] sm:p-3">
        <div className="relative aspect-square overflow-hidden rounded-xl">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <EventPoster image={event.image} title={event.title} category={event.category} sizes="96px" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!event.allDay && <span className="inline-flex items-center gap-1 font-semibold text-primary"><Clock className="size-3.5" aria-hidden />{event.time}</span>}
            {multiDay && <span className="text-muted-foreground">· višednevno</span>}
          </div>
          <h4 className="truncate font-heading text-lg font-semibold leading-snug transition-colors group-hover:text-primary">{event.title}</h4>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary/70" aria-hidden />
            <span className="truncate">{event.venue}, {event.city}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {(event.categories.length > 0 ? event.categories : [{ slug: event.category, name: event.category }]).map((category) => (
              <CategoryBadge key={category.slug} category={category.slug} />
            ))}
            <PriceBadge free={event.free} price={event.price} />
          </div>
        </div>
      </Link>
    </li>
  )
}

function MiniMonth({
  grid,
  label,
  events,
  todayKey,
  selectedDay,
  onPrev,
  onNext,
  onSelect,
}: {
  grid: { date: Date; inMonth: boolean }[]
  label: string
  events: CroEvent[]
  todayKey: string
  selectedDay: string | null
  onPrev: () => void
  onNext: () => void
  onSelect: (d: Date) => void
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onPrev} aria-label="Prethodni mjesec" className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="font-heading text-sm font-semibold">{label}</span>
        <button onClick={onNext} aria-label="Sljedeci mjesec" className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.6rem] font-medium uppercase text-muted-foreground">
        {WEEKDAY_SHORT_HR.map((d) => <span key={d}>{d.slice(0, 1)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const key = dateKey(date)
          const has = events.some((e) => eventOccursOn(e, date))
          const isToday = key === todayKey
          const isSelected = key === selectedDay
          return (
            <button
              key={i}
              onClick={() => onSelect(date)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-xs transition-colors",
                !inMonth && "text-muted-foreground/40",
                isSelected && "bg-primary font-semibold text-primary-foreground",
                !isSelected && isToday && "font-semibold text-accent-foreground ring-1 ring-accent",
                !isSelected && !isToday && "hover:bg-muted",
              )}
            >
              {date.getDate()}
              {has && !isSelected && <span className="absolute bottom-1 size-1 rounded-full bg-accent" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
