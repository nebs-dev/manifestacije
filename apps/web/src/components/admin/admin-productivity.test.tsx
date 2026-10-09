// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import OrganizersPage from "../../../app/admin/organizers/page"
import EventsPage from "../../../app/admin/events/page"
import { EventCreatorReport } from "./event-creator-report"
import { PublicEventLink } from "./public-event-link"
import type { EventFilters } from "@/lib/admin/event-filters"
import type { AdminEvent } from "@/lib/admin/types"

const api = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const table = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/events", useRouter: () => ({ replace }) }))
vi.mock("@/components/admin/events-table", () => ({ EventsTable: (props: { filters: EventFilters; onPageChange: (page: number) => void; onFiltersChange: (filters: EventFilters) => void }) => {
  table(props)
  return <div><button onClick={() => props.onPageChange(2)}>Druga stranica</button><button onClick={() => props.onFiltersChange({ search: "", fieldFilters: [] })}>Očisti sve</button></div>
} }))
const organizers = [
  { id: 4, name: "Šušur Đurđevac", slug: "susur", email: null, websiteUrl: null, phone: null, status: "UNCLAIMED", hasUser: false, adminViewedAt: "2026-10-01T12:00:00Z", createdAt: "2026-10-01T12:00:00Z", eventCount: 12 },
  { id: 5, name: "Zagreb", slug: "zagreb", email: "org@example.test", websiteUrl: null, phone: null, status: "VERIFIED", hasUser: true, adminViewedAt: null, createdAt: "2026-10-01T12:00:00Z", eventCount: 0 },
]
const report = { total: 8, unknownCount: 2, adminCount: 5, organizerCount: 1, organizer: { id: 4, name: "Šušur Đurđevac" }, creators: [
  { id: 1, name: "Vanesa", email: "vanesa@example.test", role: "ADMIN", count: 3, organizer: null },
  { id: 2, name: "Andrijana", email: "andrijana@example.test", role: "ADMIN", count: 2, organizer: null },
  { id: 3, name: "Organizator", email: "org@example.test", role: "ORGANIZER", count: 1, organizer: { name: "Šušur Đurđevac" } },
] }
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  api.mockReset().mockImplementation(async (path: string) => ({ ok: true, json: async () => path.includes("creator-report") ? report : path.includes("organizers") ? organizers : { items: [], total: 8 } }))
  table.mockReset(); replace.mockReset()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)) }
const click = async (text: string) => { await act(async () => [...container.querySelectorAll("button")].find(el => el.textContent === text)!.click()) }
async function input(label: string, value: string, tag = "input") {
  const el = container.querySelector(`${tag}[aria-label="${label}"]`)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(tag === "select" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(el, value)
    el.dispatchEvent(new Event(tag === "select" ? "change" : "input", { bubbles: true }))
  })
}

describe("organizer list", () => {
  it("searches Croatian names, keeps event counts/actions and links to association filters", async () => {
    await render(<OrganizersPage />)
    await input("Pretraži organizatore po nazivu", "SUSUR durdevac")
    expect(container.textContent).toContain("1 od 2 organizatora")
    expect(container.textContent).not.toContain("org@example.test")
    const link = container.querySelector('a[href="/admin/events?organizerId=4"]')!
    expect(link.textContent).toBe("Prikaži događaje")
    expect(link.parentElement?.textContent).toContain("12")
    expect(container.querySelector('button[aria-label="Uredi"]')).not.toBeNull()
    await act(async () => (container.querySelector('thead input[type="checkbox"]') as HTMLInputElement).click())
    expect(container.textContent).toContain("1 odabrano")
    await input("Pretraži organizatore po nazivu", "xyz")
    expect(container.textContent).toContain("Nema organizatora koji odgovaraju pretrazi.")
    expect(container.textContent).not.toContain("odabrano")
    await click("Očisti pretragu")
    expect(container.textContent).toContain("2 od 2 organizatora")
    expect(api).toHaveBeenCalledTimes(1)
  })
  it("renders loading, empty and recoverable error states", async () => {
    api.mockReturnValueOnce(new Promise(() => {}))
    await render(<OrganizersPage />)
    expect(container.querySelector('a[href*="organizerId"]')).toBeNull()
    await render(<OrganizersPage key="empty" />)
    api.mockResolvedValueOnce({ ok: true, json: async () => [] })
    await render(<OrganizersPage key="empty2" />)
    expect(container.textContent).toContain("Nema organizatora.")
    api.mockResolvedValueOnce({ ok: false })
    await render(<OrganizersPage key="error" />)
    expect(container.textContent).toContain("Greška pri učitavanju.")
  })
})

describe("creator filters and report", () => {
  it("shows all authors, separates association and emits combined creator/date filters", async () => {
    const change = vi.fn(), filters = { search: "koncert", fieldFilters: [], organizerId: "4", createdFrom: "2026-10-01", createdTo: "2026-10-09" }
    await render(<EventCreatorReport filters={filters} onChange={change} />)
    expect(container.textContent).toContain("Šušur Đurđevac")
    for (const text of ["Vanesa", "Andrijana", "Administratori: 5", "Organizatorski računi: 1", "Nepoznato: 2"]) expect(container.textContent).toContain(text)
    await input("Dodao", "unknown", "select")
    expect(change).toHaveBeenLastCalledWith({ ...filters, createdByUserId: "unknown" })
    await input("Uneseno do", "2026-10-10")
    expect(change).toHaveBeenLastCalledWith({ ...filters, createdTo: "2026-10-10" })
    await click("Ukloni filtar organizatora")
    expect(change).toHaveBeenLastCalledWith({ ...filters, organizerId: "" })
    await render(<EventCreatorReport filters={{ ...filters, createdByUserId: "1" }} onChange={change} />)
    expect(api).toHaveBeenCalledTimes(1) // selecting one creator keeps the comparison population
    await click("Ukloni filtre autora i razdoblja")
    expect(change).toHaveBeenLastCalledWith({ ...filters, createdByUserId: "", createdFrom: "", createdTo: "" })
  })
  it("shows a report error and retries without displaying stale counts", async () => {
    api.mockResolvedValueOnce({ ok: false })
    await render(<EventCreatorReport filters={{ search: "", fieldFilters: [] }} onChange={vi.fn()} />)
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).not.toContain("ukupno 8")
    await click("Pokušaj ponovno")
    expect(container.textContent).toContain("ukupno 8")
  })
  it("preserves organizer, creator, date, search and column filters across API requests/pagination and clears them", async () => {
    const searchParams = { organizerId: "4", createdByUserId: "1", createdFrom: "2026-10-01", createdTo: "2026-10-09", search: "koncert", fieldFilters: '[{"id":"f","field":"city","op":"contains","value":"Zagreb"}]', pageSize: "25" }
    await render(<EventsPage searchParams={searchParams} />)
    await click("Druga stranica")
    const paths = api.mock.calls.map(([path]) => path as string).filter(path => path.startsWith("/api/admin/events?"))
    const params = new URL(paths.at(-1)!, "https://example.test").searchParams
    expect(Object.fromEntries(params)).toMatchObject({ ...searchParams, page: "2", sortBy: "createdAt" })
    expect(replace.mock.calls.at(-1)![0]).toContain("organizerId=4")
    expect(table.mock.calls.at(-1)![0].filters).toMatchObject({ organizerId: "4", createdByUserId: "1" })
    await click("Očisti sve")
    const last = api.mock.calls.map(([path]) => path as string).filter(path => path.startsWith("/api/admin/events?")).at(-1)!
    expect(last).not.toContain("organizerId"); expect(last).not.toContain("createdByUserId"); expect(last).toContain("page=1")
  })
  it("updates filters on external URL navigation without remounting the form", async () => {
    await render(<EventsPage searchParams={{ organizerId: "4", createdByUserId: "1" }} />)
    await render(<EventsPage searchParams={{ organizerId: "5", createdByUserId: "unknown", page: "2" }} />)
    expect(table.mock.calls.at(-1)![0].filters).toMatchObject({ organizerId: "5", createdByUserId: "unknown" })
    expect(table.mock.calls.at(-1)![0].pagination.page).toBe(2)
    expect(replace.mock.calls.at(-1)![0]).toContain("organizerId=5")
  })
})

it("renders safe public links only for accessible events", async () => {
  const event = { status: "published", slug: "objavljeni-koncert", publishedAt: "2026-10-01T12:00:00Z" } as AdminEvent
  await render(<PublicEventLink event={event} />)
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/eventi/objavljeni-koncert")
  expect(container.textContent).toBe("Otvori javnu stranicu")
  expect(container.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer")
  await render(<PublicEventLink event={{ ...event, status: "draft" }} />)
  expect(container.querySelector("a")).toBeNull()
})
