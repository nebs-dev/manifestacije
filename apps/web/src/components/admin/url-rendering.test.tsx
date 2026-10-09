// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SourceReview } from "./source-review"
import { RandomSwapPartnerStrip } from "@/components/public/random-swap-partner-strip"
import type { EventSource } from "@/lib/admin/types"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock("@/lib/admin/api", () => ({ authedFetch: vi.fn() }))

const source = (overrides: Partial<EventSource>): EventSource => ({
  id: "1", sourceUrl: "", subject: "Izvor", from: "", type: "URL", status: "PENDING", confidence: 0,
  candidateCount: 0, createdAt: "2026-10-01T10:00:00.000Z", adminViewedAt: null,
  organizerName: null, organizerEmail: null, ...overrides,
} as EventSource)

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const render = async (ui: React.ReactNode) => { await act(async () => root.render(ui)) }

const hrefs = () => [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"))
const srcs = () => [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))
const dangerous = (value: string | null) => !!value && /^\s*(javascript|data|vbscript):/i.test(value)

describe("admin source review URL rendering", () => {
  it("does not render organizer-submitted javascript:/data: links as href or src", async () => {
    await render(<SourceReview candidates={[]} source={source({
      sourceUrl: "javascript:alert(document.cookie)",
      sourceImageUrl: "data:text/html,<script>alert(1)</script>",
    })} />)

    expect(hrefs().filter(dangerous)).toEqual([])
    expect(srcs().filter(dangerous)).toEqual([])
    expect(container.querySelector('a[aria-label="Otvori URL izvora"]')).toBeNull()
    expect(container.textContent).not.toContain("Screenshot / plakat izvora")
  })

  it("keeps legitimate source and evidence links", async () => {
    await render(<SourceReview candidates={[]} source={source({
      sourceUrl: "https://www.entrio.hr/event/koncert",
      sourceImageUrl: "https://res.cloudinary.com/demo/image/upload/proof.jpg",
    })} />)

    expect(hrefs()).toContain("https://www.entrio.hr/event/koncert")
    expect(hrefs()).toContain("https://res.cloudinary.com/demo/image/upload/proof.jpg")
    expect(srcs()).toContain("https://res.cloudinary.com/demo/image/upload/proof.jpg")
  })
})

describe("public partner strip URL rendering", () => {
  it("drops unsafe website links and logos, keeps safe ones", async () => {
    await render(<RandomSwapPartnerStrip partners={[
      { id: 1, name: "Zli", logoUrl: "https://cdn.example.com/a.png", websiteUrl: "javascript:alert(1)", sortOrder: 0 },
      { id: 2, name: "Bez loga", logoUrl: "javascript:alert(1)", websiteUrl: "https://ok.example.com", sortOrder: 1 },
      { id: 3, name: "Dobar", logoUrl: "https://cdn.example.com/b.png", websiteUrl: "www.dobar.hr", sortOrder: 2 },
    ]} />)

    expect(hrefs().filter(dangerous)).toEqual([])
    expect(srcs().filter(dangerous)).toEqual([])
    expect(hrefs()).toContain("https://www.dobar.hr")
    expect(srcs()).toContain("https://cdn.example.com/a.png")
  })
})
