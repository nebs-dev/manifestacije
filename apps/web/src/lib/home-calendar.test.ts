import { describe, expect, it } from "vitest"
import { calendarTeaserDates } from "./home-calendar"

describe("homepage calendar teaser dates", () => {
  it("uses unique upcoming occurrence dates from already-fetched events", () => {
    const dates = calendarTeaserDates([
      { date: "2026-08-17" },
      { date: "2026-08-19", occurrences: [{ date: "2026-08-20" }, { date: "2026-08-18" }, { date: "2026-08-20" }] },
      { date: "2026-08-22" },
      { date: "2026-08-21" },
      { date: "2026-08-23" },
    ], new Date("2026-08-18T10:00:00+02:00"))

    expect(dates).toEqual(["2026-08-18", "2026-08-20", "2026-08-21", "2026-08-22"])
  })

  it("falls back to four Zagreb calendar dates when no event dates exist", () => {
    expect(calendarTeaserDates([], new Date("2026-03-28T23:30:00Z"))).toEqual([
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
    ])
  })

  it("fills a short event-date list without duplicating dates", () => {
    expect(calendarTeaserDates([
      { date: "2026-08-20" },
      { date: "2026-08-20" },
    ], new Date("2026-08-18T10:00:00+02:00"))).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ])
  })
})
