import { describe, expect, it } from "vitest"
import { eventDisplayEnd, eventTimeLabel, isOvernightEvent } from "./event-end"

const day = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit" }).format(value)
describe("exclusive displayed end date", () => {
  it.each([
    ["2026-09-10T18:00:00+02:00", "2026-09-11T00:00:00+02:00", "2026-09-10"],
    ["2026-09-10T18:00:00+02:00", "2026-09-11T00:01:00+02:00", "2026-09-10"],
    ["2026-09-10T18:00:00+02:00", "2026-09-11T02:00:00+02:00", "2026-09-10"],
    ["2026-03-29T00:00:00+01:00", "2026-03-30T00:00:00+02:00", "2026-03-29"],
    ["2026-10-25T00:00:00+02:00", "2026-10-26T00:00:00+01:00", "2026-10-25"],
  ])("groups %s to %s through %s", (start, end, expected) => {
    expect(day(eventDisplayEnd(new Date(start), new Date(end)))).toBe(expected)
  })
  it("preserves inclusive all-day endpoints", () => {
    const end = new Date("2026-09-11T00:00:00+02:00")
    expect(eventDisplayEnd(new Date("2026-09-10T00:00:00+02:00"), end, true)).toBe(end)
  })
})

describe("overnight classification", () => {
  it.each([
    ["2026-10-09T22:00:00+02:00", "2026-10-10T02:00:00+02:00", true],
    ["2026-10-09T22:00:00+02:00", "2026-10-10T06:00:00+02:00", true],
    ["2026-10-09T22:00:00+02:00", "2026-10-10T06:00:01+02:00", false],
    ["2026-10-09T06:00:00+02:00", "2026-10-10T06:00:00+02:00", false],
    ["2026-10-09T22:00:00+02:00", "2026-10-11T02:00:00+02:00", false],
    ["2026-10-09T22:00:00+02:00", "2026-10-09T23:00:00+02:00", false],
    ["2026-03-28T22:00:00+01:00", "2026-03-29T04:00:00+02:00", true],
    ["2026-10-24T22:00:00+02:00", "2026-10-25T04:00:00+01:00", true],
    ["2026-12-31T22:00:00+01:00", "2027-01-01T02:00:00+01:00", true],
  ])("classifies %s → %s", (start, end, expected) => {
    expect(isOvernightEvent(new Date(start), new Date(end))).toBe(expected)
    expect(isOvernightEvent(new Date(start), new Date(end), true)).toBe(false)
  })
  it("renders both clocks while preserving the actual endpoint", () => {
    const event = { time: "22:00", startsAtISO: "2026-10-09T22:00:00+02:00", endsAtISO: "2026-10-10T02:00:00+02:00" }
    expect(eventTimeLabel(event)).toBe("22:00–02:00")
    expect(event.endsAtISO).toBe("2026-10-10T02:00:00+02:00")
  })
})
