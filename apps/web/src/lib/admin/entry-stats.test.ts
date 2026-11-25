import { describe, expect, it } from "vitest"
import { addMonths, barHeight, calendarGrid, compareWithPrevious, formatMinutes, formatTimeWithSeconds, formatWeekday, heatLevel, isLongGap, isWeekend, statsCsvRows } from "./entry-stats"

describe("entry statistics formatting", () => {
  it.each([
    [null, "—"],
    [0.5, "30 s"],
    [7, "7 min"],
    [59.6, "60 min"],
    [125, "2 h 05 min"],
  ])("writes %s minutes as %s", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected)
  })

  it("shows the entry time to the second, in Zagreb", () => {
    // 23:30:05 UTC in November is 00:30:05 the next day in Zagreb.
    expect(formatTimeWithSeconds("2026-11-25T23:30:05.000Z")).toBe("00:30:05")
  })

  it("marks Saturdays and Sundays", () => {
    expect(isWeekend("2026-11-28")).toBe(true)
    expect(isWeekend("2026-11-29")).toBe(true)
    expect(isWeekend("2026-11-30")).toBe(false)
  })

  it("names the weekday of a day key", () => {
    expect(formatWeekday("2026-11-25").toLowerCase()).toContain("sri")
  })
})

describe("comparison with the previous period", () => {
  it("reports the change in both directions", () => {
    expect(compareWithPrevious(120, 100)).toEqual({ delta: 20, percent: 20 })
    expect(compareWithPrevious(80, 100)).toEqual({ delta: -20, percent: -20 })
  })

  it("gives no percentage when the previous period held nothing", () => {
    expect(compareWithPrevious(9, 0)).toEqual({ delta: 9, percent: null })
  })
})

describe("calendar heatmap", () => {
  it("keeps an empty day out of every heat level", () => {
    expect(heatLevel(0, 10)).toBe(0)
  })

  it("scales against the busiest day of the month", () => {
    expect(heatLevel(10, 10)).toBe(4)
    expect(heatLevel(6, 10)).toBe(3)
    expect(heatLevel(4, 10)).toBe(2)
    expect(heatLevel(1, 10)).toBe(1)
  })

  it("gives a single-entry month its own full shade rather than a washed-out one", () => {
    expect(heatLevel(1, 1)).toBe(4)
  })

  it("pads the first week so the month starts under its weekday, Monday first", () => {
    // 2026-11-01 is a Sunday: six empty cells precede it.
    const grid = calendarGrid(["2026-11-01", "2026-11-02"])
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(grid[6]).toBe("2026-11-01")
    // 2026-12-01 is a Tuesday: one empty cell.
    expect(calendarGrid(["2026-12-01"])).toEqual([null, "2026-12-01"])
  })
})

describe("month stepping", () => {
  it.each([
    ["2026-11", 1, "2026-12"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", -1, "2025-12"],
  ])("steps %s by %s to %s", (month, delta, expected) => {
    expect(addMonths(month, delta)).toBe(expected)
  })
})

describe("long gaps", () => {
  it("marks nothing while no cap is chosen", () => {
    expect(isLongGap(600, null)).toBe(false)
  })

  it("marks a gap over the chosen cap", () => {
    expect(isLongGap(31, 30)).toBe(true)
    expect(isLongGap(30, 30)).toBe(false)
  })
})

describe("chart bars", () => {
  it("never divides by an empty series", () => {
    expect(barHeight(0, 0)).toBe(0)
  })

  it("gives the tallest bar the full height and a non-zero value a visible one", () => {
    expect(barHeight(10, 10)).toBe(100)
    expect(barHeight(1, 1000)).toBe(4)
    expect(barHeight(0, 10)).toBe(0)
  })
})

describe("statistics export", () => {
  const stats = {
    range: { from: "2026-10-31T23:00:00.000Z", to: "2026-11-26T23:00:00.000Z" },
    totals: { total: 3, admin: 3, organizer: 0, unknown: 0, today: 0, yesterday: 0, thisWeek: 0, thisMonth: 3,
      averagePerDay: 1.5, published: 2, deleted: 1, previousTotal: 1, previousRange: { from: "", to: "" } },
    users: [
      { userId: 1, name: "Vanesa", role: "ADMIN", organizerName: null, total: 3, today: 0, thisWeek: 0, thisMonth: 3,
        activeDays: 2, averagePerActiveDay: 1.5, lastEntryAt: "2026-11-02T08:00:00.000Z", sharePercent: 100 },
      { userId: 2, name: "Neaktivna", role: "ADMIN", organizerName: null, total: 0, today: 0, thisWeek: 0, thisMonth: 0,
        activeDays: 0, averagePerActiveDay: 0, lastEntryAt: null, sharePercent: 0 },
    ],
    daily: [{ date: "2026-11-01", total: 1, byUser: { 1: 1 } }, { date: "2026-11-02", total: 2, byUser: { 1: 2 } }],
  }

  it("exports one column per active author and one row per day", () => {
    const rows = statsCsvRows(stats)
    expect(rows).toContainEqual(["Datum", "Vanesa", "Ukupno"])
    expect(rows.some(row => row[0] === "01. 11. 2026." && row[2] === 1)).toBe(true)
  })

  it("leaves accounts with no entries out of the export", () => {
    expect(JSON.stringify(statsCsvRows(stats))).not.toContain("Neaktivna")
  })

  it("carries the totals, including what was published and deleted", () => {
    const rows = statsCsvRows(stats)
    expect(rows).toContainEqual(["Objavljeno", 2])
    expect(rows).toContainEqual(["Obrisano (evidentirano)", 1])
  })
})
