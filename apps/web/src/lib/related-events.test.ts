import { describe, expect, it } from "vitest"
import { events, type CroEvent } from "./data"
import { rankRelatedEvents } from "./related-events"
const make = (slug: string, city = "Osijek", category: CroEvent["category"] = "glazba", region: CroEvent["region"] = "slavonija"): CroEvent => ({
  ...events[0], slug, title: slug, city, citySlug: undefined, category, categories: [{ slug: category, name: category }], region,
  date: "2099-07-04", endDate: undefined, startsAtISO: undefined, endsAtISO: undefined, occurrences: [], time: "18:00",
})
describe("related public events", () => {
  it("prioritizes city/category, region/category, then city", () => {
    const current = make("current")
    const candidates = [make("fallback", "Split", "sport", "dalmacija"), make("category", "Split", "glazba", "dalmacija"), make("city", "Osijek", "sport"), make("region", "Vukovar"), make("both")]
    expect(rankRelatedEvents(current, candidates).map(e => e.slug)).toEqual(["both", "region", "city"])
    expect(rankRelatedEvents(current, [...candidates].reverse())).toEqual(rankRelatedEvents(current, candidates))
  })
  it("excludes current event, expired events and duplicate records", () => {
    const current = make("current"), relevant = make("relevant")
    const old = { ...make("old"), date: "2000-01-01" }
    const copy = { ...relevant, slug: "relevant-copy" }
    expect(rankRelatedEvents(current, [current, old, relevant, relevant, copy]).map(e => e.slug)).toEqual(["relevant"])
  })
  it("gives unrelated pages distinct relevant sets", () => {
    const osijek = make("osijek-page"), split = make("split-page", "Split", "sport", "dalmacija")
    const candidates = [1, 2, 3].flatMap(n => [make(`osijek-${n}`), make(`split-${n}`, "Split", "sport", "dalmacija")])
    expect(rankRelatedEvents(osijek, candidates).map(e => e.slug)).toEqual(["osijek-1", "osijek-2", "osijek-3"])
    expect(rankRelatedEvents(split, candidates).map(e => e.slug)).toEqual(["split-1", "split-2", "split-3"])
  })
})
