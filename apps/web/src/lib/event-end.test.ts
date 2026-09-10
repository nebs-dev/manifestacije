import { describe, expect, it } from "vitest"
import { eventDisplayEnd } from "./event-end"

const day = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit" }).format(value)
describe("exclusive displayed end date", () => {
  it.each([
    ["2026-09-10T18:00:00+02:00", "2026-09-11T00:00:00+02:00", "2026-09-10"],
    ["2026-09-10T18:00:00+02:00", "2026-09-11T00:01:00+02:00", "2026-09-11"],
    ["2026-09-10T18:00:00+02:00", "2026-09-11T02:00:00+02:00", "2026-09-11"],
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
