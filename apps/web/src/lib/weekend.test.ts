import { describe, expect, it } from "vitest"
import type { CroEvent } from "./data"
import { currentWeekendDisplayRange, eventOccursDuringCurrentWeekend, groupWeekendEvents } from "./weekend"
import { weekendPageCanonical, weekendPageDescription, weekendPageTitle } from "./weekend-page"

function event(overrides: Partial<CroEvent>): CroEvent {
  return {
    slug: overrides.slug ?? "event",
    title: overrides.title ?? "Event",
    category: "festivali",
    categories: [{ slug: "festivali", name: "Festivali" }],
    region: "slavonija",
    city: "Osijek",
    citySlug: "osijek",
    venue: "Venue",
    date: "2026-07-03",
    time: "20:00",
    free: false,
    forKids: false,
    outdoor: false,
    description: "Opis",
    longDescription: "Dugi opis",
    organizer: "Organizator",
    source: "Manual",
    map: { x: 50, y: 50 },
    ...overrides,
  }
}

describe("weekend helpers", () => {
  const now = new Date("2026-07-01T10:00:00.000Z")

  it("calculates the visible Friday-Sunday range in Europe/Zagreb", () => {
    const range = currentWeekendDisplayRange(now)

    expect(range.startKey).toBe("2026-07-03")
    expect(range.endKey).toBe("2026-07-05")
    expect(range.longLabel).toBe("od petka 3. srpnja do nedjelje 5. srpnja")
  })

  it("includes Friday and Sunday events but excludes Thursday-only and Monday-only events", () => {
    expect(eventOccursDuringCurrentWeekend(event({ date: "2026-07-03" }), now)).toBe(true)
    expect(eventOccursDuringCurrentWeekend(event({ date: "2026-07-05" }), now)).toBe(true)
    expect(eventOccursDuringCurrentWeekend(event({ date: "2026-07-02" }), now)).toBe(false)
    expect(eventOccursDuringCurrentWeekend(event({ date: "2026-07-06" }), now)).toBe(false)
  })

  it("groups events into active weekend days and hides empty day sections at render input level", () => {
    const multiDay = event({
      slug: "multi",
      title: "Multi-day festival",
      date: "2026-07-03",
      endDate: "2026-07-05",
      time: "18:00",
    })
    const saturday = event({
      slug: "sat",
      title: "Saturday concert",
      date: "2026-07-04",
      time: "20:00",
    })
    const grouped = groupWeekendEvents([multiDay, saturday], now)
    const visibleLabels = grouped.days.filter((day) => day.events.length > 0).map((day) => day.label)

    expect(visibleLabels).toEqual(["Petak", "Subota", "Nedjelja"])
    expect(grouped.days[0].events.map((item) => item.slug)).toEqual(["multi"])
    expect(grouped.days[1].events.map((item) => item.slug)).toEqual(["multi", "sat"])
    expect(grouped.days[2].events.map((item) => item.slug)).toEqual(["multi"])
  })

  it("keeps empty weekend days empty so the page can omit their headings", () => {
    const grouped = groupWeekendEvents([event({ slug: "fri", date: "2026-07-03" })], now)
    const visibleLabels = grouped.days.filter((day) => day.events.length > 0).map((day) => day.label)

    expect(visibleLabels).toEqual(["Petak"])
  })

  it("uses explicit occurrences, preserves schedule gaps and expands two same-day slots", () => {
    const scheduled = event({
      slug: "scheduled",
      date: "2026-07-03",
      endDate: "2026-07-05",
      occurrences: [
        { id: "1", date: "2026-07-03", startsAtISO: "2026-07-03T18:00:00+02:00", time: "18:00", allDay: false },
        { id: "2", date: "2026-07-05", startsAtISO: "2026-07-05T10:00:00+02:00", time: "10:00", allDay: false },
        { id: "3", date: "2026-07-05", startsAtISO: "2026-07-05T18:00:00+02:00", time: "18:00", allDay: false },
      ],
    })
    const grouped = groupWeekendEvents([scheduled], now)
    expect(grouped.days[0].events.map((item) => item.displayOccurrenceId)).toEqual(["1"])
    expect(grouped.days[1].events).toEqual([])
    expect(grouped.days[2].events.map((item) => item.displayOccurrenceId)).toEqual(["2", "3"])
  })

  it("exposes canonical weekend SEO metadata", () => {
    expect(weekendPageTitle).toBe("Kamo za vikend? Događanja ovaj vikend od petka do nedjelje | Manifestacije")
    expect(weekendPageDescription).toBe("Ne znaš kamo za vikend? Pogledaj aktualna događanja ovaj vikend: koncerte, predstave, festivale, radionice i druga događanja od petka do nedjelje.")
    expect(weekendPageCanonical).toBe("https://manifestacije.hr/ovaj-vikend")
  })
})
