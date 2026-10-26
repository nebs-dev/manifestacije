import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

type AnyElement = ReactElement<Record<string, unknown>>

/** Collects every <script type="application/ld+json"> payload in an element tree. */
function jsonLdBlocks(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(jsonLdBlocks)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const element = node as AnyElement
  const props = element.props ?? {}
  const own = props.type === "application/ld+json"
    ? [JSON.parse((props.dangerouslySetInnerHTML as { __html: string }).__html)]
    : []
  return [...own, ...jsonLdBlocks(props.children)]
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("/danas discovery SEO (SEO-13)", () => {
  it("keeps its title and declares a self-canonical with a full-length description", async () => {
    const { metadata } = await import("../../app/danas/page")

    expect(metadata.title).toBe("Događanja danas")
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/danas")
    expect(String(metadata.description).length).toBeGreaterThanOrEqual(120)
    expect(String(metadata.description).length).toBeLessThanOrEqual(155)
  })

  it("renders BreadcrumbList and ItemList structured data", async () => {
    // Running now, so it is today's event whatever the clock says.
    const apiEvent = {
      id: 1,
      title: "Koncert danas",
      slug: "koncert-danas",
      startsAt: new Date(Date.now() - 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      cityName: "Osijek",
      category: { id: 1, name: "Glazba", slug: "glazba" },
      categories: [],
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [apiEvent] })))
    const { default: TodayPage } = await import("../../app/danas/page")

    const blocks = jsonLdBlocks(await TodayPage()) as Array<Record<string, unknown>>
    const breadcrumbs = blocks.find((block) => block["@type"] === "BreadcrumbList")
    const itemList = blocks.find((block) => block["@type"] === "ItemList")

    expect(breadcrumbs).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Početna", item: "http://localhost:3000/" },
        { "@type": "ListItem", position: 2, name: "Danas", item: "http://localhost:3000/danas" },
      ],
    })
    expect(itemList).toEqual({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: [{ "@type": "ListItem", position: 1, url: "http://localhost:3000/eventi/koncert-danas" }],
    })
  })

  it("omits the ItemList when nothing happens today", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })))
    const { default: TodayPage } = await import("../../app/danas/page")

    const blocks = jsonLdBlocks(await TodayPage()) as Array<Record<string, unknown>>

    expect(blocks.map((block) => block["@type"])).toEqual(["BreadcrumbList"])
  })
})
