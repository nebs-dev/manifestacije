import { describe, expect, it } from "vitest"
import type { CroEvent } from "./data"
import { eventHasEnded, formatOccurrenceLabel } from "./event-schedule"

const event = (overrides: Partial<CroEvent> = {}): CroEvent => ({
  slug: "event",
  title: "Event",
  category: "manifestacije",
  categories: [{ slug: "manifestacije", name: "Manifestacije" }],
  region: "slavonija",
  city: "Osijek",
  venue: "Osijek",
  date: "2026-08-14",
  startsAtISO: "2026-08-14T18:00:00+02:00",
  time: "18:00",
  free: true,
  forKids: false,
  outdoor: false,
  description: "Opis",
  longDescription: "Opis",
  organizer: "Organizator",
  source: "Manifestacije.hr",
  map: { x: 50, y: 50 },
  ...overrides,
})

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

describe("historical event state", () => {
  const now = new Date("2026-08-15T12:00:00+02:00")

  it("marks a legacy event as ended after its endpoint", () => {
    expect(eventHasEnded(event({ endsAtISO: "2026-08-14T22:00:00+02:00" }), now)).toBe(true)
  })

  it("stays active while any occurrence is upcoming", () => {
    expect(eventHasEnded(event({
      occurrences: [
        { id: "1", date: "2026-08-14", startsAtISO: "2026-08-14T18:00:00+02:00", time: "18:00", allDay: false },
        { id: "2", date: "2026-08-16", startsAtISO: "2026-08-16T18:00:00+02:00", time: "18:00", allDay: false },
      ],
    }), now)).toBe(false)
  })

  it("keeps an all-day event active through its Zagreb calendar date", () => {
    expect(eventHasEnded(event({
      date: "2026-08-15",
      allDay: true,
      startsAtISO: "2026-08-15T00:00:00+02:00",
    }), now)).toBe(false)
  })
})

 it("shows an exclusive midnight end as 24:00 on the starting day", () => {
  expect(formatOccurrenceLabel({ id: "midnight", date: "2026-08-14", startsAtISO: "2026-08-14T18:00:00+02:00", endsAtISO: "2026-08-15T00:00:00+02:00", time: "18:00", allDay: false }))
    .toBe("14. kolovoza · 18:00–24:00")
 })
