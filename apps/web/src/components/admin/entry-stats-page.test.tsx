// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EntryStatsPage } from "./entry-stats-page"
import type { ContentStats, EntryStats, EntryTimeline, EntryTrends } from "@/lib/admin/entry-stats"

const api = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))

const stats: EntryStats = {
  range: { from: "2026-10-31T23:00:00.000Z", to: "2026-11-26T23:00:00.000Z" },
  totals: {
    total: 42, admin: 38, organizer: 3, unknown: 1, published: 36, deleted: 2,
    today: 4, yesterday: 6, thisWeek: 11, thisMonth: 42, averagePerDay: 1.7,
    previousTotal: 30, previousRange: { from: "2026-10-06T22:00:00.000Z", to: "2026-10-31T23:00:00.000Z" },
  },
  users: [
    { userId: 1, name: "Vanesa", role: "ADMIN", organizerName: null, total: 30, today: 3, thisWeek: 8, thisMonth: 30, activeDays: 12, averagePerActiveDay: 2.5, lastEntryAt: "2026-11-25T09:30:00.000Z", sharePercent: 78.9 },
    { userId: 2, name: "Andrijana", role: "ADMIN", organizerName: null, total: 8, today: 1, thisWeek: 3, thisMonth: 8, activeDays: 4, averagePerActiveDay: 2, lastEntryAt: "2026-11-24T18:00:00.000Z", sharePercent: 21.1 },
    { userId: 5, name: "Neaktivna", role: "ADMIN", organizerName: null, total: 0, today: 0, thisWeek: 0, thisMonth: 0, activeDays: 0, averagePerActiveDay: 0, lastEntryAt: null, sharePercent: 0 },
    { userId: 9, name: "Klub Oxygene", role: "ORGANIZER", organizerName: "Oxygene", total: 3, today: 0, thisWeek: 0, thisMonth: 3, activeDays: 2, averagePerActiveDay: 1.5, lastEntryAt: "2026-11-10T12:00:00.000Z", sharePercent: 100 },
  ],
  daily: [
    { date: "2026-11-01", total: 0, byUser: {} },
    { date: "2026-11-02", total: 5, byUser: { 1: 4, 2: 1 } },
    { date: "2026-11-03", total: 2, byUser: { 1: 2 } },
  ],
}

const timeline: EntryTimeline = {
  date: "2026-11-02", userId: 1,
  entries: [
    { id: 11, title: "Koncert u Tvrđi", createdAt: "2026-11-02T08:00:05.000Z", status: "PUBLISHED" },
    { id: 12, title: "Izložba", createdAt: "2026-11-02T08:12:35.000Z", status: "PENDING_REVIEW" },
  ],
  firstAt: "2026-11-02T08:00:05.000Z", lastAt: "2026-11-02T08:12:35.000Z",
  gapsMinutes: [12.5], averageGapMinutes: 12.5, medianGapMinutes: 12.5,
  shortestGapMinutes: 12.5, longestGapMinutes: 12.5, excludedGaps: 0, spanMinutes: 12.5,
  perHour: { 9: 2 },
}

const trends: EntryTrends = {
  months: [
    { month: "2026-09", total: 8, byUser: { 1: 8 } },
    { month: "2026-10", total: 30, byUser: { 1: 20, 2: 10 } },
    { month: "2026-11", total: 42, byUser: { 1: 30, 2: 8 } },
  ],
  weekdays: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, total: weekday === 2 ? 20 : 4 })),
  hours: Array.from({ length: 24 }, (_, hour) => ({ hour, total: hour === 9 ? 15 : 1 })),
  monthToDate: { month: "2026-11", total: 42, previousMonth: "2026-10", previousTotal: 26, throughDay: 25 },
}

const content: ContentStats = {
  range: stats.range,
  byCity: [{ id: 1, name: "Osijek", total: 30 }, { id: 5, name: "Đakovo", total: 12 }],
  byCounty: [{ id: 2, name: "Osječko-baranjska", total: 42 }],
  byCategory: [{ id: 3, name: "Glazba", total: 20 }, { id: null, name: "Bez kategorije", total: 2 }],
  published: 36, unpublished: 6, upcoming: 25, enteredOnEventDay: 3,
  averageLeadDays: 21.4, medianLeadDays: 12,
  pendingDuplicates: 4,
  incomplete: { total: 5, withoutImage: 3, withoutLocation: 1, withoutDescription: 2,
    items: [{ id: 51, title: "Bez slike", missing: ["slika"] }] },
}

const response = (value: unknown) => ({ ok: true, json: async () => value, text: async () => "" })
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  api.mockReset().mockImplementation(async (path: string) => response(
    path.includes("/stats/trends") ? trends
      : path.includes("/stats/content") ? content
      : path.includes("/day") ? timeline
      : stats))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

const render = async () => { await act(async () => root.render(<EntryStatsPage />)) }
const text = () => container.textContent ?? ""
const buttons = () => [...container.querySelectorAll("button")]
const click = async (element: Element | undefined | null, what: string) => {
  expect(element, what).toBeTruthy()
  await act(async () => (element as HTMLElement).click())
}
const urls = () => api.mock.calls.map(call => String(call[0]))

describe("entry statistics page", () => {
  it("opens on the current month without anyone picking a date", async () => {
    await render()

    expect(urls()[0]).toContain("preset=this-month")
    expect(text()).toContain("Statistika unosa")
  })

  it("shows the summary cards, including the comparison with the previous period", async () => {
    await render()

    const summary = container.querySelector('[aria-label="Sažetak"]')!.textContent ?? ""
    expect(summary).toContain("42")
    expect(summary).toContain("Unosi administratora")
    expect(summary).toContain("Unosi organizatora")
    expect(summary).toContain("+12")
    expect(summary).toContain("prije: 30")
    // An author that cannot be attributed is reported, not folded into a total.
    expect(summary).toContain("Nepoznat autor")
    expect(summary).toContain("Objavljeno u razdoblju")
    // Deletions only exist from the day the record was introduced, and the
    // card says so rather than implying the history is complete.
    expect(summary).toContain("Obrisano u razdoblju")
    expect(summary).toContain("evidentira se od")
  })

  it("never shows an email address", async () => {
    await render()
    expect(text()).not.toContain("@")
  })

  it("hides accounts with no activity until asked", async () => {
    await render()
    expect(text()).not.toContain("Neaktivna")

    await click(buttons().find(button => button.textContent?.includes("")) && container.querySelector('input[type="checkbox"]'), "show inactive")

    expect(text()).toContain("Neaktivna")
  })

  it("keeps organizers in their own section", async () => {
    await render()
    const organizers = container.querySelector('[aria-label="Pregled po organizatorima"]')!.textContent ?? ""
    expect(organizers).toContain("Klub Oxygene")
    expect(container.querySelector('[aria-label="Pregled po administratorima"]')!.textContent).not.toContain("Klub Oxygene")
  })

  it("asks for another period when a preset is chosen", async () => {
    await render()

    await click(buttons().find(button => button.textContent?.trim() === "Prošli tjedan"), "Prošli tjedan")

    expect(urls().at(-1)).toContain("preset=last-week")
  })

  it("steps to the previous month with the arrow", async () => {
    await render()

    await click(buttons().find(button => button.getAttribute("aria-label") === "Prethodni mjesec"), "previous month")

    expect(urls().at(-1)).toContain("month=2026-10")
  })

  it("lists every day of the range, the empty ones included", async () => {
    await render()
    const daily = container.querySelector('[aria-label="Dnevna statistika"]')!
    expect(daily.querySelectorAll("tbody tr")).toHaveLength(3)
    // hr-HR writes a date as "01. 11. 2026."
    expect(daily.textContent).toContain("01. 11. 2026.")
  })

  it("opens one editor's chronology when a number in the daily table is clicked", async () => {
    await render()
    const daily = container.querySelector('[aria-label="Dnevna statistika"]')!

    await click([...daily.querySelectorAll("button")].find(button => button.textContent?.trim() === "4"), "cell with 4 entries")

    const dayUrl = urls().at(-1)!
    expect(dayUrl).toContain("date=2026-11-02")
    expect(dayUrl).toContain("userId=1")
    const details = container.querySelector('[aria-label="Detalji dana"]')!.textContent ?? ""
    expect(details).toContain("Koncert u Tvrđi")
    // Seconds are part of the request.
    expect(details).toContain("09:00:05")
    expect(details).toContain("Prosječan razmak")
    expect(details).toContain("dinamiku unosa, ne radno vrijeme")
  })

  it("re-asks for the chronology with the chosen pause cap", async () => {
    await render()
    const daily = container.querySelector('[aria-label="Dnevna statistika"]')!
    await click([...daily.querySelectorAll("button")].find(button => button.textContent?.trim() === "4"), "cell with 4 entries")

    const select = container.querySelector("#gap-cap") as HTMLSelectElement
    await act(async () => {
      select.value = "30"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(urls().at(-1)).toContain("gapCapMinutes=30")
  })

  it("links a total back to the events list, filtered by author and period", async () => {
    await render()
    const link = [...container.querySelectorAll("a")].find(anchor => anchor.getAttribute("href")?.includes("createdByUserId=1"))
    expect(link?.getAttribute("href")).toContain("createdFrom=2026-11-01")
    expect(link?.getAttribute("href")).toContain("createdTo=2026-11-03")
  })

  it("draws a calendar cell per day with its count", async () => {
    await render()
    const calendar = container.querySelector('[aria-label="Kalendar aktivnosti"]')!
    const cells = [...calendar.querySelectorAll("button")]
    expect(cells).toHaveLength(3)
    expect(cells.map(cell => cell.getAttribute("aria-label"))).toContain("02. 11. 2026.: 5 unosa")
  })

  it("says so when the statistics cannot be loaded", async () => {
    api.mockResolvedValue({ ok: false, json: async () => ({}), text: async () => "" })
    await render()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("nije moguće učitati")
  })
})

describe("trends, content statistics and export", () => {
  it("draws a bar per month, per weekday and per hour", async () => {
    await render()
    const section = container.querySelector('[aria-label="Trendovi"]')!
    expect(section.textContent).toContain("Unosi po mjesecima")
    // 3 months + 7 weekdays + 24 hours
    expect(section.querySelectorAll("[aria-label]").length).toBeGreaterThanOrEqual(34)
    expect(section.textContent).toContain("42")
    expect(section.textContent).toContain("26")
  })

  it("steps to a month when its bar is clicked", async () => {
    await render()
    const section = container.querySelector('[aria-label="Trendovi"]')!
    const october = [...section.querySelectorAll("button")].find(bar => bar.getAttribute("aria-label")?.includes("listopad"))

    await click(october, "October bar")

    expect(urls().at(-1)).toContain("month=2026-10")
  })

  it("shows what the portal gained: places, categories and publication state", async () => {
    await render()
    const section = container.querySelector('[aria-label="Statistika sadržaja"]')!.textContent ?? ""
    expect(section).toContain("Osijek")
    expect(section).toContain("Osječko-baranjska")
    expect(section).toContain("Bez kategorije")
    expect(section).toContain("Objavljeno")
    expect(section).toContain("Nadolazeći")
    expect(section).toContain("Uneseno na dan održavanja")
    expect(section).toContain("Mogući duplikati")
    expect(section).toContain("Nepotpun sadržaj")
    expect(section).toContain("nedostaje: slika")
  })

  it("exports the tables as a CSV file", async () => {
    const created: string[] = []
    vi.stubGlobal("URL", { ...URL, createObjectURL: (blob: Blob) => { created.push(String(blob.size)); return "blob:csv" }, revokeObjectURL: () => {} })
    const clicks: string[] = []
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const element = realCreate(tag)
      if (tag === "a") element.click = () => clicks.push((element as HTMLAnchorElement).download)
      return element
    }) as typeof document.createElement)

    await render()
    await click(buttons().find(button => button.textContent?.includes("Izvoz (CSV)")), "export")

    expect(clicks[0]).toMatch(/^statistika-unosa-2026-11-01_2026-11-03\.csv$/)
    expect(created).toHaveLength(1)
  })
})
