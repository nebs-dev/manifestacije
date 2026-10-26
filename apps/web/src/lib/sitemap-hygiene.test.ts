import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

const appDir = path.resolve(__dirname, "../../app")

const emptyData = {
  events: [],
  regions: [],
  cities: [],
  categories: [],
  cityCategories: [],
  regionCategories: [],
  weekendCities: [],
  weekendRegions: [],
}

async function sitemapUrls(data: Record<string, unknown> = emptyData) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => data })))
  const { default: sitemap } = await import("../../app/sitemap")
  return await sitemap()
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("sitemap hygiene (SEO-12)", () => {
  it("lists every indexable standalone page", async () => {
    const urls = (await sitemapUrls()).map((entry) => entry.url)

    expect(urls).toEqual([
      "http://localhost:3000",
      "http://localhost:3000/eventi",
      "http://localhost:3000/danas",
      "http://localhost:3000/ovaj-vikend",
      "http://localhost:3000/kalendar",
      "http://localhost:3000/prosli-dogadaji",
      "http://localhost:3000/mapa",
      "http://localhost:3000/gradovi",
      "http://localhost:3000/regije",
      "http://localhost:3000/uvjeti-koristenja",
      "http://localhost:3000/pravila-privatnosti",
      "http://localhost:3000/kolacici",
    ])
  })

  it.each(["pridruzi-se", "preuzmi-profil", "dodaj-event"])("keeps the non-indexable page /%s out", async (slug) => {
    const urls = (await sitemapUrls()).map((entry) => entry.url)

    expect(urls).not.toContain(`http://localhost:3000/${slug}`)
  })

  it("dates event URLs by content change, not by generation time", async () => {
    const urls = await sitemapUrls({ ...emptyData, events: [{ slug: "koncert", updatedAt: "2026-10-01T10:00:00.000Z" }] })

    expect(urls).toContainEqual({ url: "http://localhost:3000/eventi/koncert", lastModified: "2026-10-01T10:00:00.000Z" })
  })

  // Every URL in the sitemap has to carry a canonical pointing at itself;
  // scripts/check-sitemap.mjs enforces the same rule against a running site.
  it.each([
    ["mapa/page.tsx", "/mapa"],
    ["regije/page.tsx", "/regije"],
    ["uvjeti-koristenja/page.tsx", "/uvjeti-koristenja"],
    ["pravila-privatnosti/page.tsx", "/pravila-privatnosti"],
    ["kolacici/page.tsx", "/kolacici"],
  ])("declares a self-canonical in %s", (file, route) => {
    const source = readFileSync(path.join(appDir, file), "utf8")

    expect(source).toContain(`alternates: { canonical: \`\${WEB_URL}${route}\` }`)
  })
})
