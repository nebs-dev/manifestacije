import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { canonicalRegionSlug } from "./seo-taxonomy"

const appDir = path.resolve(__dirname, "../../app")
const srcDir = path.resolve(__dirname, "..")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name.startsWith(".") ? [] : sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx") ? [full] : []
  })
}

const sitemapData = {
  events: [],
  regions: [{ slug: "slavonija-i-baranja" }],
  cities: [],
  categories: [],
  cityCategories: [],
  regionCategories: [{ regionSlug: "slavonija-i-baranja", categorySlug: "glazba" }],
  weekendCities: [],
  weekendRegions: [{ slug: "slavonija-i-baranja" }],
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("canonical region slug (SEO-11)", () => {
  it.each([
    ["slavonija-i-baranja", "slavonija"],
    ["zagreb-i-okolica", "zagreb"],
    ["istra-i-kvarner", "istra"],
    ["sredisnja-hrvatska", "sredisnja"],
    ["lika-i-gorski-kotar", "lika"],
    ["medimurje-i-zagorje", "medimurje"],
  ])("maps the API slug %s to %s", (apiSlug, canonical) => {
    expect(canonicalRegionSlug(apiSlug)).toBe(canonical)
  })

  it.each(["slavonija", "dalmacija", "nepoznato"])("leaves %s untouched", (slug) => {
    expect(canonicalRegionSlug(slug)).toBe(slug)
  })

  it("lists only canonical region URLs in the sitemap", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => sitemapData })))
    const { default: sitemap } = await import("../../app/sitemap")

    const urls = (await sitemap()).map((entry) => entry.url)

    expect(urls).toContain("http://localhost:3000/regije/slavonija")
    expect(urls).toContain("http://localhost:3000/regije/slavonija/kategorije/glazba")
    expect(urls).toContain("http://localhost:3000/kamo-za-vikend/regije/slavonija")
    expect(urls.filter((url) => url.includes("slavonija-i-baranja"))).toEqual([])
  })

  it("redirects every long region slug, its subpaths and the weekend page", async () => {
    // next.config.js is plain CommonJS with no types; require it as data.
    const config = createRequire(__filename)("../../next.config.js") as { redirects: () => Promise<Array<{ source: string; destination: string; statusCode?: number }>> }

    const redirects = await config.redirects()

    for (const [alias, canonical] of [["slavonija-i-baranja", "slavonija"], ["medimurje-i-zagorje", "medimurje"]]) {
      expect(redirects).toContainEqual({ source: `/regije/${alias}`, destination: `/regije/${canonical}`, statusCode: 301 })
      expect(redirects).toContainEqual({ source: `/regije/${alias}/:path*`, destination: `/regije/${canonical}/:path*`, statusCode: 301 })
      expect(redirects).toContainEqual({ source: `/kamo-za-vikend/regije/${alias}`, destination: `/kamo-za-vikend/regije/${canonical}`, statusCode: 301 })
    }
  })

  it("has no internal link left on a non-canonical region URL", () => {
    const offenders = [...sourceFiles(appDir), ...sourceFiles(srcDir)].filter((file) =>
      /["'`]\/(kamo-za-vikend\/)?regije\/[a-z-]+-i-[a-z-]+/.test(readFileSync(file, "utf8")),
    )

    expect(offenders).toEqual([])
  })
})
