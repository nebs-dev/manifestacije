import { describe, expect, it } from "vitest"
import { eventToICS, googleCalendarUrl } from "./calendar"
import type { CroEvent } from "./data"

const event: CroEvent = {
  slug: "festival",
  title: "Festival",
  category: "festivali",
  categories: [{ slug: "festivali", name: "Festivali" }],
  region: "slavonija",
  city: "Osijek",
  venue: "Tvrđa",
  date: "2026-08-14",
  time: "08:00",
  startsAtISO: "2026-08-14T08:00:00+02:00",
  free: true,
  forKids: false,
  outdoor: true,
  description: "Opis",
  longDescription: "Opis",
  organizer: "Organizator",
  source: "https://example.com/festival",
  map: { x: 50, y: 50 },
  occurrences: [
    { id: "11", date: "2026-08-14", startsAtISO: "2026-08-14T08:00:00+02:00", endsAtISO: "2026-08-14T22:00:00+02:00", time: "08:00", allDay: false },
    { id: "12", date: "2026-08-15", startsAtISO: "2026-08-15T18:00:00+02:00", endsAtISO: "2026-08-15T23:00:00+02:00", time: "18:00", allDay: false },
  ],
}

describe("multi-occurrence calendar export", () => {
  it("writes one VEVENT and stable UID per occurrence", () => {
    const ics = eventToICS(event)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain("UID:festival-11@manifestacije.hr")
    expect(ics).toContain("UID:festival-12@manifestacije.hr")
  })

  it("builds Google Calendar URL for selected occurrence", () => {
    const url = new URL(googleCalendarUrl(event, "12"))
    expect(url.searchParams.get("dates")).toBe("20260815T160000Z/20260815T210000Z")
  })

  it("exports all-day occurrences as date-only inclusive days", () => {
    const allDayEvent: CroEvent = {
      ...event,
      occurrences: [{
        id: "21",
        date: "2026-08-14",
        endDate: "2026-08-14",
        startsAtISO: "2026-08-14T00:00:00+02:00",
        endsAtISO: "2026-08-14T23:59:59+02:00",
        time: "00:00",
        allDay: true,
      }],
    }
    const ics = eventToICS(allDayEvent)
    expect(ics).toContain("DTSTART;VALUE=DATE:20260814")
    expect(ics).toContain("DTEND;VALUE=DATE:20260815")
    expect(new URL(googleCalendarUrl(allDayEvent, "21")).searchParams.get("dates")).toBe("20260814/20260815")
  })
})
