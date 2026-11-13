import { describe, expect, it } from "vitest"

import { missingOf } from "./candidate-rail"
import { DEFAULT_SOURCE_FILTER } from "./source-filters"
import { withContext } from "./source-evidence"
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

describe("withContext", () => {
  const lines = ["a", "b", "HIT", "c", "d", "e", "f", "g", "HIT2", "h"]

  it("keeps the lines around a hit, because the title matches and the date is under it", () => {
    expect(withContext(lines, [2], 2)).toEqual(["a", "b", "HIT", "c", "d"])
  })

  it("marks where it cut the source out", () => {
    const out = withContext(lines, [2, 8], 1)
    expect(out).toEqual(["b", "HIT", "c", "…", "g", "HIT2", "h"])
  })

  it("does not repeat a line two hits share", () => {
    const out = withContext(lines, [2, 4], 2)
    expect(out).toEqual(["a", "b", "HIT", "c", "d", "e", "f"])
    expect(new Set(out).size).toBe(out.length)
  })

  it("stays inside the text at either end", () => {
    expect(withContext(lines, [0], 3)).toEqual(lines.slice(0, 4))
    expect(withContext(lines, [lines.length - 1], 2)).toEqual(lines.slice(-3))
  })
})
