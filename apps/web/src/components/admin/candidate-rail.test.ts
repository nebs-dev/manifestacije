import { describe, expect, it } from "vitest"

import { missingOf } from "./candidate-rail"
import { DEFAULT_SOURCE_FILTER } from "./source-filters"
import type { ParsedCandidate } from "@/lib/admin/types"

const candidate = (over: Partial<ParsedCandidate> = {}): ParsedCandidate =>
  ({
    id: "1",
    sourceId: "1",
    candidateIndex: 0,
    title: "Koncert u parku",
    description: "Opis.",
    startsAt: "2027-06-01T20:00:00+02:00",
    endsAt: "",
    city: "Osijek",
    venueName: "Park",
    address: "",
    category: "glazba",
    isFree: null,
    priceText: "",
    ticketUrl: "",
    organizerName: "",
    imageUrl: "",
    sourceUrl: "",
    confidence: 0.9,
    missingFields: [],
    warnings: [],
    ...over,
  }) as ParsedCandidate

/**
 * What the rail tells an editor before they open anything.
 *
 * The four fields below are the ones creation is refused without, so naming
 * them in the list is what lets an editor pick the candidate they can finish
 * rather than discovering the gap after opening it.
 */
describe("missingOf", () => {
  it("says nothing is missing from a complete candidate", () => {
    expect(missingOf(candidate())).toEqual([])
  })

  it("names each field creation would be refused without", () => {
    expect(missingOf(candidate({ title: "" }))).toContain("naslov")
    expect(missingOf(candidate({ startsAt: "" }))).toContain("datum")
    expect(missingOf(candidate({ city: "" }))).toContain("grad")
    expect(missingOf(candidate({ category: "" }))).toContain("kategorija")
  })

  it("counts whitespace as absent, because it is", () => {
    expect(missingOf(candidate({ city: "   " }))).toContain("grad")
  })

  it("lists several at once, in a fixed order", () => {
    expect(missingOf(candidate({ title: "", city: "", category: "" }))).toEqual(["naslov", "grad", "kategorija"])
  })
})

describe("DEFAULT_SOURCE_FILTER", () => {
  it("opens the inbox on what still needs an editor, across every status", () => {
    // The queue is append-only: defaulting to "everything" is what made it 38
    // pages. Status is a narrowing control, so it starts empty.
    expect(DEFAULT_SOURCE_FILTER.actionable).toBe(true)
    expect(DEFAULT_SOURCE_FILTER.status).toBe("")
    expect(DEFAULT_SOURCE_FILTER.type).toBe("")
    expect(DEFAULT_SOURCE_FILTER.unviewed).toBe(false)
  })
})
