import { describe, expect, it } from "vitest"
import { safeExternalUrl } from "./safe-url"

describe("safeExternalUrl", () => {
  it.each([
    "https://www.entrio.hr/event/koncert-123",
    "http://example.com/a?b=1#c",
    "https://res.cloudinary.com/demo/image/upload/v1/event.jpg",
    "HTTPS://Example.com/Path",
  ])("keeps legitimate http(s) link %s unchanged", (url) => {
    expect(safeExternalUrl(url)).toBe(url)
  })

  it("trims surrounding whitespace", () => {
    expect(safeExternalUrl("  https://entrio.hr/x  ")).toBe("https://entrio.hr/x")
  })

  it.each([
    ["www.entrio.hr", "https://www.entrio.hr"],
    ["entrio.hr/koncert?id=5", "https://entrio.hr/koncert?id=5"],
    ["www.entrio.hr:8080/x", "https://www.entrio.hr:8080/x"],
    ["//cdn.example.com/a.jpg", "https://cdn.example.com/a.jpg"],
  ])("prefixes scheme-less link %s with https", (input, expected) => {
    expect(safeExternalUrl(input)).toBe(expected)
  })

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(document.cookie)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0001javascript:alert(1)",
    "javascript://example.com/%0aalert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "mailto:a@example.com",
    "/admin/events",
    "\\\\evil.com",
    "/\\evil.com",
    "TBA",
    "Ulaznice na blagajni",
    "",
    "   ",
  ])("rejects %j", (input) => {
    expect(safeExternalUrl(input)).toBeUndefined()
  })

  it("allows tel:/mailto: only for contact-capable fields", () => {
    expect(safeExternalUrl("tel:099-488-9294", { allowContactLinks: true })).toBe("tel:099-488-9294")
    expect(safeExternalUrl("mailto:ulaznice@udruga.hr", { allowContactLinks: true })).toBe("mailto:ulaznice@udruga.hr")
    expect(safeExternalUrl("tel:099-488-9294")).toBeUndefined()
    expect(safeExternalUrl("tel:javascript:alert(1)", { allowContactLinks: true })).toBeUndefined()
    expect(safeExternalUrl("javascript:alert(1)", { allowContactLinks: true })).toBeUndefined()
    expect(safeExternalUrl("data:text/html,x", { allowContactLinks: true })).toBeUndefined()
  })

  it("rejects non-strings", () => {
    expect(safeExternalUrl(null)).toBeUndefined()
    expect(safeExternalUrl(undefined)).toBeUndefined()
    expect(safeExternalUrl(42)).toBeUndefined()
  })
})
