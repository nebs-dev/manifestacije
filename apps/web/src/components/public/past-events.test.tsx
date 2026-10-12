import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { generateMetadata } from "../../../app/prosli-dogadaji/page"
import { EventCard } from "./event-card"
import { events } from "@/lib/data"

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock("./prefetch-event-link", () => ({ PrefetchEventLink: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }))
vi.mock("./event-poster", () => ({ EventPoster: () => null }))

describe("past events archive (PUB-06)", () => {
  it("indexes only the first archive page, with self-referencing canonicals", async () => {
    const first = await generateMetadata({ searchParams: {} })
    expect(first.title).toBe("Prošli događaji")
    expect(first.robots).toBeUndefined()
    expect(first.alternates?.canonical).toMatch(/\/prosli-dogadaji$/)
    const third = await generateMetadata({ searchParams: { stranica: "3" } })
    expect(third.robots).toEqual({ index: false, follow: true })
    expect(third.alternates?.canonical).toMatch(/\/prosli-dogadaji\?stranica=3$/)
    expect((await generateMetadata({ searchParams: { stranica: "-5" } })).robots).toBeUndefined()
    expect((await generateMetadata({ searchParams: { stranica: "abc" } })).alternates?.canonical).toMatch(/\/prosli-dogadaji$/)
  })

  it("labels archive cards as ended instead of showing a price", () => {
    const html = renderToStaticMarkup(<EventCard event={{ ...events[0], free: true }} ended />)
    expect(html).toContain("Završeno")
    expect(html).not.toContain("Besplatno")
    expect(renderToStaticMarkup(<EventCard event={{ ...events[0], free: true }} />)).not.toContain("Završeno")
  })
})
