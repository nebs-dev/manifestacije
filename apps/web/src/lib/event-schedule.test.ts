import { describe, expect, it } from "vitest"
import { formatOccurrenceLabel } from "./event-schedule"

describe("occurrence labels", () => {
  it("formats same-day timed, overnight, and all-day rows in Croatian", () => {
    expect(formatOccurrenceLabel({
      id: "1",
      date: "2026-08-14",
      startsAtISO: "2026-08-14T08:00:00+02:00",
      endsAtISO: "2026-08-14T22:00:00+02:00",
      time: "08:00",
      allDay: false,
    })).toBe("14. kolovoza · 08:00–22:00")

    expect(formatOccurrenceLabel({
      id: "2",
      date: "2026-08-14",
      endDate: "2026-08-15",
      startsAtISO: "2026-08-14T22:00:00+02:00",
      endsAtISO: "2026-08-15T02:00:00+02:00",
      time: "22:00",
      allDay: false,
    })).toBe("14. kolovoza · 22:00 – 15. kolovoza · 02:00")

    expect(formatOccurrenceLabel({
      id: "3",
      date: "2026-08-16",
      startsAtISO: "2026-08-16T00:00:00+02:00",
      endsAtISO: "2026-08-16T23:59:59+02:00",
      time: "00:00",
      allDay: true,
    })).toBe("16. kolovoza · Cijeli dan")
  })
})
