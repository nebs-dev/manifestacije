// Calendar → event detail → calendar scroll restoration (PUB-02).
//
// Next 14 restores app-router history entries inside a transition, so the
// browser's native scroll restoration runs against the previous page's DOM and
// gets clamped. The "Natrag na kalendar" link is a push and starts at the top.
// We therefore remember the clicked agenda entry (one record per tab) and
// restore it when the calendar is re-entered through history traversal or the
// back link. The record is consumed on the next calendar mount.

const STORAGE_KEY = "manifestacije:calendar-return"

export type CalendarReturnRecord = {
  href: string
  entry: string
  top: number
  scrollY: number
  keyboard: boolean
  armed: boolean
}

let lastTraversalHref: string | null = null

export function canonicalCalendarHref(href: string) {
  const url = new URL(href, "http://local")
  url.searchParams.sort()
  return `${url.pathname}?${url.searchParams.toString()}`
}

function currentHref() {
  return canonicalCalendarHref(window.location.pathname + window.location.search)
}

function read(): CalendarReturnRecord | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<CalendarReturnRecord>
    if (typeof value.href !== "string" || typeof value.entry !== "string" || typeof value.top !== "number" || typeof value.scrollY !== "number") return null
    return { href: value.href, entry: value.entry, top: value.top, scrollY: value.scrollY, keyboard: value.keyboard === true, armed: value.armed === true }
  } catch {
    return null
  }
}

function write(record: CalendarReturnRecord | null) {
  try {
    if (record) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode, blocked site data): restoration is best effort.
  }
}

export function calendarEntryKey(day: string, slug: string, occurrenceId?: string | number | null) {
  return `${day}|${slug}|${occurrenceId ?? "legacy"}`
}

/** Called when an agenda entry link is activated. */
export function rememberCalendarEntry(entry: string, element: Element, keyboard: boolean) {
  write({ href: currentHref(), entry, top: element.getBoundingClientRect().top, scrollY: window.scrollY, keyboard, armed: false })
}

/** Called by "Natrag na kalendar" before navigating to the calendar. */
export function armCalendarReturn(href: string) {
  const record = read()
  if (record && record.href === canonicalCalendarHref(href)) write({ ...record, armed: true })
}

function onPopState() {
  lastTraversalHref = currentHref()
  armCalendarReturn(lastTraversalHref)
}

if (typeof window !== "undefined") window.addEventListener("popstate", onPopState)

export type CalendarEntryKind = "return" | "traverse" | "reload" | "enter"

/**
 * Classifies the current calendar mount and consumes any stored record.
 * Only an armed record for this exact calendar URL is returned.
 */
export function takeCalendarEntry(): { kind: CalendarEntryKind; record: CalendarReturnRecord | null } {
  const href = currentHref()
  const record = read()
  write(null)
  const traversed = lastTraversalHref === href
  lastTraversalHref = null
  if (record?.armed && record.href === href) return { kind: "return", record }
  if (traversed) return { kind: "traverse", record: null }
  const navigation = window.performance?.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined
  if (navigation && navigation.type !== "navigate" && canonicalCalendarHref(navigation.name) === href) return { kind: "reload", record: null }
  return { kind: "enter", record: null }
}

/** Puts the remembered entry back at the same viewport offset; returns false if it is not rendered. */
export function restoreCalendarEntry(record: CalendarReturnRecord) {
  const element = [...document.querySelectorAll<HTMLElement>("[data-calendar-entry]")].find((el) => el.dataset.calendarEntry === record.entry)
  if (!element) {
    window.scrollTo({ top: record.scrollY, behavior: "instant" })
    return false
  }
  window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - record.top, behavior: "instant" })
  if (record.keyboard) element.focus({ preventScroll: true })
  return true
}
