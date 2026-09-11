// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { EventFilters } from "./event-filters"
import { FiltersPanel } from "./filters-panel"
import { CategoryStrip } from "./category-strip"
import { ActiveFilters } from "./active-filters"
import { CalendarExplorer } from "./calendar-explorer"
import { HomeHero } from "./home-hero"
import { DiscoveryExplorer } from "./discovery-explorer"
import { events } from "@/lib/data"

const nav = vi.hoisted(() => ({ query: "", pathname: "/eventi", push: vi.fn(), replace: vi.fn() }))
const analytics = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => nav.pathname, useSearchParams: () => new URLSearchParams(nav.query) }))
vi.mock("@/lib/analytics", () => ({ trackEvent: analytics, trackDiscoveryNavigation: vi.fn() }))
vi.mock("@/lib/route-progress", () => ({ startProgress: vi.fn() }))
vi.mock("./event-poster", () => ({ EventPoster: () => null }))
vi.mock("./quick-filters", () => ({ QuickFilters: () => null }))
vi.mock("next/image", () => ({ default: () => null }))
vi.mock("next/dynamic", () => ({ default: () => (props: { cityCenter?: number[] }) => <div data-testid="map" data-center={JSON.stringify(props.cityCenter)} /> }))

let container: HTMLDivElement, root: Root
const scroll = vi.fn()
const frames: FrameRequestCallback[] = []
beforeEach(() => {
  vi.stubGlobal("React", React)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  Element.prototype.scrollIntoView = scroll
  nav.query = ""; nav.pathname = "/eventi"
  vi.clearAllMocks(); frames.length = 0
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const render = async (ui: React.ReactNode) => { await act(async () => root.render(ui)); await act(async () => { frames.splice(0).forEach(callback => callback(0)) }) }
const click = async (button: Element) => { await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true }))) }
const button = (text: string) => [...container.querySelectorAll("button")].find(el => el.textContent?.trim() === text)!

it("submits homepage text and normalized city independently without leaking search text", async () => {
  await render(<HomeHero />)
  container.querySelector<HTMLInputElement>('input[name="q"]')!.value = "koncert"
  container.querySelector<HTMLInputElement>('input[name="grad"]')!.value = "Osijek"
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
  expect(nav.push).toHaveBeenCalledWith("/eventi?q=koncert&grad=osijek")
  expect(analytics).toHaveBeenCalledWith({ name: "home_search", params: { has_text: true, has_city: true } })
})
it("toggles category off, keeps other filters, and restores Back state", async () => {
  nav.query = "grad=osijek&q=koncert&kategorija=glazba&besplatno=1"
  await render(<EventFilters categories={[{ id: 1, name: "Glazba", slug: "glazba", sortOrder: 0 }]} />)
  expect(button("Glazba").getAttribute("aria-pressed")).toBe("true")
  await click(button("Glazba"))
  expect(nav.push).toHaveBeenLastCalledWith("/eventi?grad=osijek&q=koncert&besplatno=1", { scroll: false })
  nav.query = "grad=osijek&q=koncert&besplatno=1"
  await render(<EventFilters />)
  expect(button("Glazba").getAttribute("aria-pressed")).toBe("false")
  nav.query += "&kategorija=glazba"
  await render(<EventFilters />)
  expect(button("Glazba").getAttribute("aria-pressed")).toBe("true")
})
it("removes one visible chip and reset preserves calendar date/view", async () => {
  nav.pathname = "/kalendar"; nav.query = "q=koncert&grad=osijek&vani=1&datum=2099-07-04&pogled=tjedan"
  await render(<ActiveFilters />)
  expect(container.querySelector('[aria-label="Aktivni filtri"]')).not.toBeNull()
  await click(container.querySelector('[aria-label="Ukloni filtar: Grad: osijek"]')!)
  const removed = new URL(nav.push.mock.calls.at(-1)![0], "https://example.test").searchParams
  expect(removed.has("grad")).toBe(false); expect(removed.get("q")).toBe("koncert"); expect(removed.get("kategorija")).toBe("na-otvorenom")
  await click(button("Poništi sve"))
  expect(nav.push).toHaveBeenLastCalledWith("/kalendar?datum=2099-07-04&pogled=tjedan", { scroll: false })
})
it("scrolls direct dates and repeated empty Saturday selections; Back restores date", async () => {
  nav.pathname = "/kalendar"; nav.query = "datum=2026-09-11&pogled=tjedan&besplatno=1"
  const calendar = <CalendarExplorer events={[]} initialYear={2026} initialMonth={8} initialDate="2026-09-11" />
  await render(calendar)
  expect(scroll.mock.instances.at(-1)).toBe(document.getElementById("day-2026-09-11"))
  await click(container.querySelector('[aria-label="Odaberi 2026-09-12"]')!)
  expect(nav.push).toHaveBeenLastCalledWith("/kalendar?datum=2026-09-12&pogled=tjedan&besplatno=1", { scroll: false })
  nav.query = "datum=2026-09-12&pogled=tjedan&besplatno=1"
  await render(<CalendarExplorer events={[]} initialYear={2026} initialMonth={8} initialDate="2026-09-12" />)
  expect(scroll.mock.instances.at(-1)).toBe(document.getElementById("day-2026-09-12"))
  expect(document.getElementById("day-2026-09-12")?.textContent).toContain("Nema termina za ovaj datum")
  scroll.mockClear()
  await click(container.querySelector('[aria-label="Odaberi 2026-09-12"]')!)
  frames.splice(0).forEach(callback => callback(0))
  expect(scroll).toHaveBeenCalledTimes(1)
  nav.query = "datum=2026-09-11&pogled=tjedan&besplatno=1"
  await render(calendar)
  expect(scroll.mock.instances.at(-1)).toBe(document.getElementById("day-2026-09-11"))
})
it("passes only resolved city searches to map recentering", async () => {
  await render(<DiscoveryExplorer events={[{ ...events[0], title: "Koncert", city: "Osijek", citySlug: "osijek" }]} />)
  const input = container.querySelector("input")!
  const enter = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await enter("Osijek")
  expect(container.querySelector('[data-testid="map"]')?.getAttribute("data-center")).toBe("[45.555,18.695]")
  await enter("Koncert")
  expect(container.querySelector('[data-testid="map"]')?.hasAttribute("data-center")).toBe(false)
})

it("hides empty category promotion but keeps a selected empty direct URL removable", async () => {
  const categories = [{ id: 1, name: "Glazba", slug: "glazba", sortOrder: 0, upcomingCount: 5 }, { id: 2, name: "Sport", slug: "sport", sortOrder: 1, upcomingCount: 0 }]
  await render(<CategoryStrip inventory={categories} />)
  expect(container.querySelector('a[href="/kategorije/glazba"]')).not.toBeNull()
  expect(container.querySelector('a[href="/kategorije/sport"]')).toBeNull()
  nav.query = "kategorija=sport"
  await render(<EventFilters categories={categories} categoryCounts={{ glazba: 5, sport: 0 }} />)
  const selected = container.querySelector('[aria-pressed="true"]')!
  expect(selected).not.toBeNull()
  const sport = [...container.querySelectorAll("button")].find(el => el.textContent?.startsWith("Sport"))!
  expect(sport.getAttribute("aria-pressed")).toBe("true")
  await click(sport)
  expect(nav.push).toHaveBeenLastCalledWith("/eventi?", { scroll: false })
})
it("opens and closes mobile filters without losing active state", async () => {
  nav.query = "besplatno=1"
  await render(<><FiltersPanel /><ActiveFilters /></>)
  await click(button("Filtri"))
  expect(container.querySelector('[aria-label="Zatvori filtre"]')).not.toBeNull()
  expect([...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(input => input.checked)).toBe(true)
  await click(button("Prikaži rezultate"))
  expect(container.querySelector('[aria-label="Zatvori filtre"]')).toBeNull()
  expect(container.querySelector('[aria-label="Ukloni filtar: Besplatno"]')).not.toBeNull()
})
it("keeps calendar date and filters inside event-detail return links", async () => {
  nav.pathname = "/kalendar"; nav.query = "datum=2099-07-04&pogled=tjedan&grad=osijek&besplatno=1"
  const event = { ...events[0], date: "2099-07-04", endDate: undefined, startsAtISO: undefined, occurrences: [] }
  await render(<CalendarExplorer events={[event]} initialYear={2099} initialMonth={6} initialDate="2099-07-04" />)
  const link = container.querySelector<HTMLAnchorElement>('a[href*="returnTo="]')!
  const returnTo = new URL(link.href).searchParams.get("returnTo")!
  expect(new URL(returnTo, "https://example.test").searchParams.toString()).toBe(nav.query)
})
