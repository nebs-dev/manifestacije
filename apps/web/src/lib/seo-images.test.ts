import { existsSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_OG_IMAGE } from "./seo-images"

const publicDir = path.resolve(__dirname, "../../public")

function imageUrls(metadata: { openGraph?: unknown; twitter?: unknown }) {
  const social = [metadata.openGraph, metadata.twitter] as Array<{ images?: unknown } | undefined>
  return social.flatMap((block) =>
    (Array.isArray(block?.images) ? block.images : []).map((image: unknown) =>
      typeof image === "string" ? image : (image as { url: string }).url,
    ),
  )
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("default social image (SEO-14)", () => {
  it("ships the file it points at, as a raster format", () => {
    expect(existsSync(path.join(publicDir, DEFAULT_OG_IMAGE))).toBe(true)
    expect(DEFAULT_OG_IMAGE).toMatch(/\.(png|jpg|jpeg)$/)
  })

  it("covers the root metadata, so pages that add no openGraph of their own inherit it", async () => {
    const { metadata } = await import("../../app/layout")

    expect(imageUrls(metadata)).toEqual([DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE])
  })

  it("covers /ovaj-vikend and the city listing", async () => {
    for (const route of ["../../app/ovaj-vikend/page", "../../app/gradovi/page"]) {
      const { metadata } = await import(route)

      expect(imageUrls(metadata)).toContain(DEFAULT_OG_IMAGE)
    }
  })

  it.each([
    ["../../app/gradovi/[citySlug]/page", { citySlug: "osijek" }],
    ["../../app/kategorije/[categorySlug]/page", { categorySlug: "glazba" }],
    ["../../app/kamo-za-vikend/gradovi/[citySlug]/page", { citySlug: "karanac" }],
    ["../../app/kamo-za-vikend/regije/[regionSlug]/page", { regionSlug: "slavonija" }],
  ])("covers %s", async (route, params) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })))
    const { generateMetadata } = await import(route)

    expect(imageUrls(await generateMetadata({ params }))).toContain(DEFAULT_OG_IMAGE)
  })

  it("prefers the region's own hero photo over the fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })))
    const { generateMetadata } = await import("../../app/regije/[regionSlug]/page")

    const urls = imageUrls(await generateMetadata({ params: { regionSlug: "slavonija" } }))

    expect(urls).toEqual(["/images/region-slavonija.jpg", "/images/region-slavonija.jpg"])
    expect(existsSync(path.join(publicDir, urls[0]))).toBe(true)
  })

  it("leaves an event that has its own image alone and backfills one that has none", async () => {
    const apiEvent = {
      id: 1,
      title: "Koncert",
      slug: "koncert",
      description: "Opis",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      cityName: "Osijek",
      category: { id: 1, name: "Glazba", slug: "glazba" },
      categories: [],
    }
    const withImage = { ...apiEvent, imageUrl: "https://res.cloudinary.com/demo/image/upload/koncert.jpg" }
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => (String(input).includes("with-image") ? withImage : apiEvent),
    })))
    const { generateMetadata } = await import("../../app/eventi/[eventSlug]/page")

    expect(imageUrls(await generateMetadata({ params: { eventSlug: "koncert" } }))).toEqual([DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE])
    expect(imageUrls(await generateMetadata({ params: { eventSlug: "with-image" } })).every((url) => url.includes("cloudinary"))).toBe(true)
  })
})
