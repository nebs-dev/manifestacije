import { describe, expect, it } from "vitest"
import { toCsv } from "./csv"

describe("CSV export", () => {
  it("separates columns with a semicolon, as Croatian Excel expects", () => {
    expect(toCsv([["Korisnik", "Ukupno"], ["Vanesa", 30]])).toBe("﻿Korisnik;Ukupno\r\nVanesa;30")
  })

  it("starts with a BOM so Excel reads č and ž correctly", () => {
    expect(toCsv([["Čakovec"]]).startsWith("﻿")).toBe(true)
  })

  it("writes decimals with a comma, so Excel sees a number", () => {
    expect(toCsv([[2.5]])).toContain("2,5")
  })

  it("quotes a value containing a separator, a quote or a line break", () => {
    expect(toCsv([['Koncert; "uživo"']])).toContain('"Koncert; ""uživo"""')
    expect(toCsv([["prvi\nredak"]])).toContain('"prvi\nredak"')
  })

  it("leaves an empty cell empty rather than writing null", () => {
    expect(toCsv([[null, undefined, ""]])).toBe("﻿;;")
  })
})
