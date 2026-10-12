import { describe, expect, it } from "vitest"
import { eventShareLinks, publicEventUrl } from "./share-links"

describe("share links", () => {
  it("builds the canonical public URL and encoded share targets", () => {
    const url = publicEventUrl("koncert-tamburasi", "https://manifestacije.hr")
    expect(url).toBe("https://manifestacije.hr/eventi/koncert-tamburasi")
    const links = eventShareLinks(`Koncert "A" & <B>`, url)
    expect(links.facebook).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmanifestacije.hr%2Feventi%2Fkoncert-tamburasi")
    expect(decodeURIComponent(links.whatsapp.split("?text=")[1])).toBe(`Koncert "A" & <B> — ${url}`)
    expect(links.whatsapp).not.toMatch(/[<>"& ]/)
  })
})
