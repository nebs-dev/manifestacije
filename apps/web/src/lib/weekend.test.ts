import { describe, expect, it } from "vitest"
import type { CroEvent } from "./data"
import { currentWeekendDisplayRange, eventOccursDuringCurrentWeekend, groupWeekendEvents } from "./weekend"
import { weekendPageCanonical, weekendPageDescription, weekendPageTitle } from "./weekend-page"
import { eventDisplayEnd, zagrebDateKey } from "./event-end"
import { orderRecommendations, prioritizeFreshEvents } from "./event-order"

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
    expect(grouped.days[1].events.map((item) => item.slug)).toEqual(["sat", "multi"])
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

describe("current weekend recommendations", () => {
  const timed = (slug: string, start: string, end?: string): CroEvent => event({
    slug, date: zagrebDateKey(new Date(start)),
    endDate: end ? zagrebDateKey(eventDisplayEnd(new Date(start), new Date(end))) : undefined,
    startsAtISO: start, endsAtISO: end, time: start.slice(11, 16),
  })
  const fixtures = [
    timed("friday", "2026-07-03T20:00:00+02:00", "2026-07-03T23:00:00+02:00"),
    timed("overnight", "2026-07-03T22:00:00+02:00", "2026-07-04T02:00:00+02:00"),
    timed("saturday", "2026-07-04T20:00:00+02:00", "2026-07-04T23:00:00+02:00"),
    timed("sunday", "2026-07-05T20:00:00+02:00", "2026-07-05T23:00:00+02:00"),
    timed("festival", "2026-06-20T10:00:00+02:00", "2026-07-06T23:00:00+02:00"),
  ]
  it.each([
    ["2026-07-03T19:00:00+02:00", ["friday", "overnight", "festival"], ["saturday", "festival"], ["sunday", "festival"]],
    ["2026-07-04T00:00:00+02:00", ["overnight"], ["saturday", "festival"], ["sunday", "festival"]],
    ["2026-07-04T02:00:00+02:00", [], ["saturday", "festival"], ["sunday", "festival"]],
    ["2026-07-05T00:00:00+02:00", [], [], ["sunday", "festival"]],
    ["2026-07-05T23:00:00+02:00", [], [], ["festival"]],
  ])("filters exact Friday/Saturday/Sunday boundaries at %s", (now, friday, saturday, sunday) => {
    const grouped = groupWeekendEvents(fixtures, new Date(now))
    expect(grouped.days.map((day) => day.events.map((event) => event.slug))).toEqual([friday, saturday, sunday])
    expect(grouped.days.flatMap((day) => day.events).filter((item) => item.slug === "overnight").length).toBeLessThanOrEqual(1)
    if (friday.length === 1) expect(grouped.days[0].label).toBe("Još traje · petak")
  })
  it("moves to the next weekend exactly at Zagreb Monday midnight", () => {
    expect(currentWeekendDisplayRange(new Date("2026-07-05T21:59:59Z")).startKey).toBe("2026-07-03")
    expect(currentWeekendDisplayRange(new Date("2026-07-05T22:00:00Z")).startKey).toBe("2026-07-10")
    expect(groupWeekendEvents(fixtures, new Date("2026-07-05T22:00:00Z")).days.every((day) => day.events.length === 0)).toBe(true)
  })
  it.each([
    ["2026-03-29T01:30:00Z", "2026-03-27", "2026-03-29"],
    ["2026-10-25T01:30:00Z", "2026-10-23", "2026-10-25"],
    ["2026-12-31T23:15:00Z", "2027-01-01", "2027-01-03"],
  ])("calculates DST/year-boundary weekend %s", (now, startKey, endKey) => {
    expect(currentWeekendDisplayRange(new Date(now))).toMatchObject({ startKey, endKey })
  })
  it("checks a selected occurrence independently of later slots", () => {
    const scheduled = { ...fixtures[0], occurrences: [
      { id: "old", date: "2026-07-03", startsAtISO: fixtures[0].startsAtISO!, endsAtISO: fixtures[0].endsAtISO, time: "20:00", allDay: false },
      { id: "new", date: "2026-07-05", startsAtISO: fixtures[3].startsAtISO!, time: "20:00", allDay: false },
    ] }
    const grouped = groupWeekendEvents([scheduled], new Date("2026-07-04T12:00:00Z"))
    expect(grouped.days[0].events).toEqual([])
    expect(grouped.days[2].events.map((item) => item.displayOccurrenceId)).toEqual(["new"])
  })
  it("demotes ongoing long ranges using actual starts while retaining homepage diversity order", () => {
    const continuing = { ...fixtures[4], date: "2026-07-04" }
    const upcoming = [fixtures[3], fixtures[2]]
    expect(orderRecommendations([continuing, ...upcoming], "2026-07-04").map((e) => e.slug)).toEqual(["saturday", "sunday", "festival"])
    expect(prioritizeFreshEvents([continuing, ...upcoming], "2026-07-04").map((e) => e.slug)).toEqual(["sunday", "saturday", "festival"])
  })
})


it("orders repeated DST clocks by the actual instant", () => {
  const early = event({ slug: "early", startsAtISO: "2026-10-25T02:30:00+02:00" })
  const late = event({ slug: "late", startsAtISO: "2026-10-25T02:30:00+01:00" })
  expect(orderRecommendations([late, early], "2026-10-25").map((event) => event.slug)).toEqual(["early", "late"])
})
