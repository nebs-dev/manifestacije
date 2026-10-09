import { describe, expect, it } from "vitest"
import { buildOrganizerEventBody, invalidLegacyUrl, organizerUrlError } from "./event-form-model"

const schedule = [{ startsAt: "2099-09-05T16:00:00.000Z", endsAt: null, isAllDay: false }]
const base = { schedule, sendOccurrences: false, isFree: false, priceText: "", ticketUrl: "", sourceUrl: "", imageUrl: "" }

describe("organizer event body (EVT-06)", () => {
  it("sends explicit null for every cleared optional field and keeps them through JSON", () => {
    const body = JSON.parse(JSON.stringify(buildOrganizerEventBody(base)))
    expect(body).toEqual(expect.objectContaining({ endsAt: null, priceText: null, ticketUrl: null, sourceUrl: null, imageUrl: null }))
  })

  it("keeps filled values (trimmed)", () => {
    const body = buildOrganizerEventBody({ ...base, priceText: " 10 EUR ", ticketUrl: " https://www.entrio.hr/x ", sourceUrl: "https://u.hr", imageUrl: "https://res.cloudinary.com/a.jpg" })
    expect(body).toEqual(expect.objectContaining({ priceText: "10 EUR", ticketUrl: "https://www.entrio.hr/x", sourceUrl: "https://u.hr", imageUrl: "https://res.cloudinary.com/a.jpg" }))
  })

  it("does not touch the hidden price/ticket fields while the event is free", () => {
    const body = buildOrganizerEventBody({ ...base, isFree: true, priceText: "10 EUR", ticketUrl: "https://x.hr" })
    expect(body).not.toHaveProperty("priceText")
    expect(body).not.toHaveProperty("ticketUrl")
    expect(body.isFree).toBe(true)
  })

  it("sends occurrences only when asked to", () => {
    expect(buildOrganizerEventBody(base).occurrences).toBeUndefined()
    expect(buildOrganizerEventBody({ ...base, sendOccurrences: true }).occurrences).toEqual(schedule)
  })
})

describe("legacy invalid links", () => {
  it("flags an unchanged stored value that is not a valid link", () => {
    expect(invalidLegacyUrl("racesmanager", "racesmanager", true)).toBe(true)
    expect(invalidLegacyUrl("tel:099-488-9294", "tel:099-488-9294", true)).toBe(false)
    expect(invalidLegacyUrl("https://x.hr", "https://x.hr")).toBe(false)
    expect(invalidLegacyUrl("", "racesmanager")).toBe(false)
  })

  it("lets an unchanged legacy value through but rejects new invalid values in Croatian", () => {
    const initial = { ticketUrl: "racesmanager", sourceUrl: "javascript:alert(1)" }
    expect(organizerUrlError({ ticketUrl: "racesmanager", sourceUrl: "javascript:alert(1)" }, initial)).toBeNull()
    expect(organizerUrlError({ ticketUrl: "nešto drugo", sourceUrl: "" }, initial)).toMatch(/^Link za ulaznice mora biti/)
    expect(organizerUrlError({ ticketUrl: "", sourceUrl: "javascript:alert(2)" }, initial)).toMatch(/^Poveznica na događaj mora biti/)
    expect(organizerUrlError({ ticketUrl: "www.entrio.hr", sourceUrl: "" }, initial)).toBeNull()
  })
})
