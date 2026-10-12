// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { CalendarExplorer } from "./calendar-explorer"
import { EventBackLink } from "./event-back-link"
import { events } from "@/lib/data"
import { armCalendarReturn, canonicalCalendarHref } from "@/lib/calendar-return"

const nav = vi.hoisted(() => ({ query: "", pathname: "/kalendar", push: vi.fn(), replace: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => nav.pathname, useSearchParams: () => new URLSearchParams(nav.query) }))
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackDiscoveryNavigation: vi.fn() }))
vi.mock("@/lib/route-progress", () => ({ startProgress: vi.fn() }))
vi.mock("./event-poster", () => ({ EventPoster: () => null }))
vi.mock("next/image", () => ({ default: () => null }))

const STORAGE_KEY = "manifestacije:calendar-return"
const QUERY = "datum=2099-07-04&pogled=tjedan&grad=osijek"
const CALENDAR = `/kalendar?${QUERY}`
const calendarEvents = ["prvi", "drugi", "treci"].map((slug, i) => ({
  ...events[0], slug, title: `Događaj ${slug}`, date: "2099-07-04", endDate: undefined, time: `1${i}:00`, startsAtISO: undefined, occurrences: [],
}))

let container: HTMLDivElement, root: Root
const scrollIntoView = vi.fn()
const scrollTo = vi.fn()
const frames: FrameRequestCallback[] = []
let scrollY = 0

beforeEach(() => {
  vi.stubGlobal("React", React)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  Element.prototype.scrollIntoView = scrollIntoView
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo
  scrollY = 0
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY })
  // Lay agenda links out 300px apart below a 1000px header so offsets are observable.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const links = [...document.querySelectorAll("[data-calendar-entry]")]
    const index = links.indexOf(this)
    const top = index >= 0 ? 1000 + index * 300 - scrollY : 0
    return { top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect
  }
  nav.pathname = "/kalendar"; nav.query = QUERY
  window.history.replaceState(null, "", CALENDAR)
  window.sessionStorage.clear()
  vi.clearAllMocks(); frames.length = 0
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

const flushFrames = async () => act(async () => { frames.splice(0).forEach((callback) => callback(0)) })
const mountCalendar = async () => {
  await act(async () => root.render(<CalendarExplorer events={calendarEvents} initialYear={2099} initialMonth={6} initialDate="2099-07-04" />))
  await flushFrames()
}
const unmountCalendar = async () => {
  await act(async () => root.unmount())
  root = createRoot(container)
}
const entryLink = (slug: string) => container.querySelector<HTMLAnchorElement>(`a[href^="/eventi/${slug}?"]`)!
const clickEntry = async (slug: string, init: MouseEventInit = {}) => {
  const link = entryLink(slug)
  link.addEventListener("click", (event) => event.preventDefault(), { once: true })
  await act(async () => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, ...init })))
}
const stored = () => JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null")

it("remembers the clicked entry and restores it after browser Back instead of jumping to the day", async () => {
  await mountCalendar()
  scrollY = 1200 // "treci" link at 1000 + 2*300 - 1200 = 400px from the viewport top
  await clickEntry("treci")
  expect(stored()).toMatchObject({ href: canonicalCalendarHref(CALENDAR), entry: "2099-07-04|treci|legacy", top: 400, scrollY: 1200, armed: false })
  await unmountCalendar()

  // Detail page → browser Back: the URL is already the calendar's when popstate fires.
  scrollY = 0
  window.dispatchEvent(new PopStateEvent("popstate"))
  scrollIntoView.mockClear()
  await mountCalendar()

  expect(scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: "instant" })
  expect(scrollIntoView).not.toHaveBeenCalled()
  expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
})

it("restores after the Natrag na kalendar link, regardless of query parameter order", async () => {
  await mountCalendar()
  scrollY = 700
  await clickEntry("drugi")
  await unmountCalendar()

  container.innerHTML = ""
  const back = document.createElement("div"); document.body.append(back)
  const backRoot = createRoot(back)
  const reordered = "/kalendar?pogled=tjedan&grad=osijek&datum=2099-07-04"
  await act(async () => backRoot.render(<EventBackLink href={reordered}>Natrag na kalendar</EventBackLink>))
  const link = back.querySelector("a")!
  link.addEventListener("click", (event) => event.preventDefault(), { once: true })
  await act(async () => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 })))
  expect(stored()).toMatchObject({ armed: true })
  await act(async () => backRoot.unmount()); back.remove()

  scrollY = 0
  window.history.replaceState(null, "", reordered)
  scrollIntoView.mockClear()
  await mountCalendar()
  expect(scrollTo).toHaveBeenCalledWith({ top: 700, behavior: "instant" })
  expect(scrollIntoView).not.toHaveBeenCalled()
})

it("focuses the restored entry only when it was opened from the keyboard", async () => {
  await mountCalendar()
  await clickEntry("prvi", { detail: 0 })
  await unmountCalendar()
  window.dispatchEvent(new PopStateEvent("popstate"))
  await mountCalendar()
  expect(document.activeElement).toBe(entryLink("prvi"))
})

it("ignores stale records on an unrelated calendar visit and scrolls to the selected day as on entry", async () => {
  await mountCalendar()
  scrollY = 1200
  await clickEntry("treci")
  await unmountCalendar()

  scrollY = 0
  scrollIntoView.mockClear()
  await mountCalendar() // header link / fresh visit: not armed
  expect(scrollTo).not.toHaveBeenCalled()
  expect(scrollIntoView.mock.instances.at(-1)).toBe(document.getElementById("day-2099-07-04"))
  expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
})

it("does not restore a record armed for a different calendar URL", async () => {
  await mountCalendar()
  await clickEntry("treci")
  await unmountCalendar()
  armCalendarReturn("/kalendar?datum=2099-08-01&pogled=mjesec")
  expect(stored()).toMatchObject({ armed: false })
  window.history.replaceState(null, "", "/kalendar?datum=2099-08-01&pogled=mjesec")
  window.dispatchEvent(new PopStateEvent("popstate"))
  window.history.replaceState(null, "", CALENDAR)
  await mountCalendar()
  expect(scrollTo).not.toHaveBeenCalled()
})

it("keeps the browser's position on history traversal without a remembered entry", async () => {
  window.dispatchEvent(new PopStateEvent("popstate"))
  await mountCalendar()
  expect(scrollIntoView).not.toHaveBeenCalled()
  expect(scrollTo).not.toHaveBeenCalled()
})

it("does not record modified clicks that open a new tab", async () => {
  await mountCalendar()
  await clickEntry("prvi", { metaKey: true })
  await clickEntry("prvi", { ctrlKey: true })
  expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
})

it("still scrolls to a newly selected day and ignores filter-only data changes", async () => {
  await mountCalendar()
  scrollIntoView.mockClear()
  await act(async () => root.render(<CalendarExplorer events={calendarEvents.slice(0, 1)} initialYear={2099} initialMonth={6} initialDate="2099-07-04" />))
  await flushFrames()
  expect(scrollIntoView).not.toHaveBeenCalled()
  nav.query = "datum=2099-07-05&pogled=tjedan&grad=osijek"
  await act(async () => root.render(<CalendarExplorer events={calendarEvents} initialYear={2099} initialMonth={6} initialDate="2099-07-05" />))
  await flushFrames()
  expect(scrollIntoView.mock.instances.at(-1)).toBe(document.getElementById("day-2099-07-05"))
})

it("works when session storage is unavailable", async () => {
  const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
  const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
  await mountCalendar()
  await clickEntry("prvi")
  await unmountCalendar()
  window.dispatchEvent(new PopStateEvent("popstate"))
  await expect(mountCalendar()).resolves.toBeUndefined()
  expect(container.querySelector("[data-calendar-entry]")).not.toBeNull()
  getItem.mockRestore(); setItem.mockRestore()
})
