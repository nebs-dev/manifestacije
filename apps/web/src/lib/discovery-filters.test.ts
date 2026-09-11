import { describe, expect, it } from "vitest"
import { activeDiscoveryFilters, changeDiscoveryFilter, discoveryParams, filterKeys, normalizeCity, normalizeDiscoveryParams, upcomingCategoryCounts } from "./discovery-filters"
import { events } from "./data"

describe("discovery URL contract", () => {
  it.each([["Osijek", "osijek"], [" Đakovo ", "dakovo"], ["Slavonski Brod", "slavonski-brod"]])("normalizes %s", (input, slug) => {
    expect(normalizeCity(input)).toBe(slug)
    expect(discoveryParams({ grad: input }).get("grad")).toBe(slug)
  })
  it("retains AND filters while toggling the selected category off", () => {
    const input = new URLSearchParams("q=koncert&grad=Osijek&kategorija=glazba&besplatno=1&kada=ovaj-vikend")
    const next = changeDiscoveryFilter(input, "kategorija", "glazba")
    expect(Object.fromEntries(next)).toEqual({ q: "koncert", grad: "osijek", besplatno: "1", kada: "ovaj-vikend" })
    expect(input.get("kategorija")).toBe("glazba")
  })
  it.each([["vani=1", "na-otvorenom"], ["djeca=1", "djeca-i-obitelj"], ["djeca=1&vani=1", "djeca-i-obitelj"], ["kategorija=sport&vani=1", "sport"]])("preserves legacy precedence for %s", (query, category) => {
    const canonical = normalizeDiscoveryParams(new URLSearchParams(query))
    expect(Object.fromEntries(canonical)).toEqual({ kategorija: category })
    expect(changeDiscoveryFilter(canonical, "kategorija", null).size).toBe(0)
  })
  it("summarizes every active filter and reset retains calendar state", () => {
    const params = new URLSearchParams("q=koncert&grad=Osijek&regija=slavonija&kada=danas&kategorija=glazba&besplatno=1&datum=2099-07-04&pogled=tjedan")
    expect(activeDiscoveryFilters(params).map(item => item.key)).toEqual([...filterKeys])
    filterKeys.forEach(key => params.delete(key))
    expect(Object.fromEntries(params)).toEqual({ datum: "2099-07-04", pogled: "tjedan" })
  })
  it("counts upcoming events once across primary and secondary categories", () => {
    const event = { ...events[0], date: "2099-07-04", endDate: undefined, startsAtISO: undefined, occurrences: [], category: "glazba" as const, categories: [{ slug: "glazba", name: "Glazba" }, { slug: "sport", name: "Sport" }] }
    expect(upcomingCategoryCounts([event, event, { ...event, slug: "expired", date: "2000-01-01" }])).toEqual({ glazba: 1, sport: 1 })
  })
})
