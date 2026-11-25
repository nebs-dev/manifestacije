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

describe("spreadsheet formula injection", () => {
  it.each(["=SUM(A1:A9)", "+1+1", "-1+1", "@SUM(1)"])("neutralises %s, which Excel would otherwise run", value => {
    expect(toCsv([[value]])).toContain(`'${value}`)
  })

  it("leaves an ordinary title alone", () => {
    expect(toCsv([["Koncert u Tvrđi"]])).toBe("﻿Koncert u Tvrđi")
  })

  it("does not turn a negative number into text", () => {
    expect(toCsv([[-5]])).toBe("﻿-5")
  })
})
