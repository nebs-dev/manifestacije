import { describe, it, expect } from "vitest"
import { pricingLabel, pricingState, pricingValue } from "./pricing"
import { revisionValue } from "./event-revisions"

describe("three-state pricing", () => {
  it.each([[true, "FREE", "Besplatno"], [false, "PAID", "Naplata"], [null, "UNKNOWN", "Cijena nije navedena"]] as const)("labels and round-trips %s", (value, state, label) => {
    expect(pricingState(value)).toBe(state)
    expect(pricingValue(state)).toBe(value)
    expect(pricingLabel(value)).toBe(label)
    expect(revisionValue("isFree", value)).toBe(label)
  })
  it("keeps optional text without guessing a price state", () => {
    expect(pricingLabel(null, "15 EUR")).toBe("Cijena nije navedena")
    expect(pricingLabel(false, "15 EUR")).toBe("15 EUR")
    expect(pricingLabel(true, "15 EUR")).toBe("Besplatno")
  })
})
