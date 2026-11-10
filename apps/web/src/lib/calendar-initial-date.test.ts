import { describe, expect, it } from "vitest"
import { calendarInitialDate } from "./calendar-initial-date"

describe("calendarInitialDate", () => {
  const today = "2026-11-10"

  it("opens on today when something started earlier and is still running", () => {
    expect(calendarInitialDate(["2026-11-02", "2026-11-13"], today)).toBe(today)
  })

  it("opens on today when an event is on today", () => {
    expect(calendarInitialDate([today, "2026-11-20"], today)).toBe(today)
  })

  it("opens on the first day that has something when the feed is all ahead", () => {
    expect(calendarInitialDate(["2026-12-01", "2026-11-28"], today)).toBe("2026-11-28")
  })

  it("opens on today for an empty feed", () => {
    expect(calendarInitialDate([], today)).toBe(today)
  })
})
