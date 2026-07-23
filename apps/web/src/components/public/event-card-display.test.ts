import { describe, expect, it } from "vitest"
import { eventCardDateDisplay } from "./event-card-display"

describe("eventCardDateDisplay", () => {
  it("uses the section display date for multi-day weekend cards", () => {
    expect(eventCardDateDisplay("2026-07-23", "2026-07-24")).toEqual({
      date: "2026-07-24",
      weekday: "Petak",
    })
  })

  it("falls back to the event start date outside contextual sections", () => {
    expect(eventCardDateDisplay("2026-07-23")).toEqual({
      date: "2026-07-23",
      weekday: "Četvrtak",
    })
  })
})
