import { describe, expect, it } from "vitest"
import { eventFilterParams, parseEventFilters } from "./event-filters"
import { searchOrganizers } from "./organizer-search"
import { publicEventPath } from "@/components/admin/public-event-link"
import type { AdminEvent } from "./types"

describe("organizer name search", () => {
  const organizers = [{ id: 1, name: "Đurđevački Čarobni Šušur" }, { id: 2, name: "Ćićarija Živi" }, { id: 3, name: "Zagreb" }]
  it.each(["DURDEVA", "durdevacki carobni susur", "  ŠUŠUR  ", "šušur"])("finds Croatian names for %s", query => {
    expect(searchOrganizers(organizers, query)).toEqual([organizers[0]])
  })
  it("handles every Croatian diacritic, empty searches and no matches", () => {
    expect(searchOrganizers(organizers, "cicarija zivi")).toEqual([organizers[1]])
    expect(searchOrganizers(organizers, "")).toEqual(organizers)
    expect(searchOrganizers(organizers, "missing")).toEqual([])
  })
})

describe("admin filter navigation", () => {
  it("round trips organizer, creator, both date ranges and existing filters", () => {
    const filters = { search: "  Koncert  ", organizerId: "9", createdByUserId: "unknown", createdFrom: "2026-10-01", createdTo: "2026-10-31", startsFrom: "2026-11-01", startsTo: "2026-12-01", status: "PUBLISHED", fieldFilters: [{ id: "a", field: "city", op: "contains", value: "Zagreb" }] }
    expect(parseEventFilters(Object.fromEntries(eventFilterParams(filters)))).toEqual({ ...filters, search: "Koncert" })
    expect(eventFilterParams({ search: "", fieldFilters: [] }).toString()).toBe("")
  })
  it("ignores malformed optional field filters", () => {
    expect(parseEventFilters({ fieldFilters: "bad", organizerId: ["4", "5"] })).toMatchObject({ fieldFilters: [], organizerId: "4" })
    expect(parseEventFilters({ fieldFilters: '[null,{}, {"field":"title"}]' }).fieldFilters).toHaveLength(1)
  })
})

describe("public event links", () => {
  const event = { slug: "koncert-đ", publishedAt: null } as AdminEvent
  it.each(["draft", "pending", "rejected", "archived"] as const)("hides inaccessible %s events", status => {
    expect(publicEventPath({ ...event, status })).toBeNull()
  })
  it("links published and previously published archived events with escaped slugs", () => {
    expect(publicEventPath({ ...event, status: "published" })).toBe("/eventi/koncert-%C4%91")
    expect(publicEventPath({ ...event, status: "archived", publishedAt: "2026-10-01T10:00:00Z" })).toBe("/eventi/koncert-%C4%91")
    expect(publicEventPath({ ...event, status: "published", slug: "//outside.test/x?y" })).toBe("/eventi/%2F%2Foutside.test%2Fx%3Fy")
    expect(publicEventPath({ ...event, status: "published", slug: "" })).toBeNull()
  })
})
