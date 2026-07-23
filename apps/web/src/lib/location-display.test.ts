import { describe, expect, it } from "vitest"
import { compactLocationLabel, publicAddressLine } from "./location-display"

describe("location display helpers", () => {
  it("deduplicates repeated city labels from geocoder/autocomplete results", () => {
    expect(compactLocationLabel("Belišće, Belišće")).toBe("Belišće")
    expect(compactLocationLabel("Park hrvatskih branitelja, Belišće, Belišće")).toBe("Park hrvatskih branitelja, Belišće")
  })

  it("hides public address line when address only repeats venue or city", () => {
    expect(publicAddressLine("Belišće, Belišće", "Belišće", "Park hrvatskih branitelja")).toBeNull()
    expect(publicAddressLine("Park hrvatskih branitelja, Belišće", "Belišće", "Park hrvatskih branitelja")).toBeNull()
    expect(publicAddressLine("Ulica kralja Tomislava 1, Belišće", "Belišće", "Park hrvatskih branitelja")).toBe("Ulica kralja Tomislava 1")
  })
})
