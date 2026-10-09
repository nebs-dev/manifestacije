import type { CroEvent } from "./data"
import { zagrebDateKey } from "./event-end"

/** Continuing ranges remain discoverable after events starting on this day.
 * Use the actual selected occurrence, never a display date advanced to today. */
export function orderRecommendations(events: CroEvent[], day = zagrebDateKey()): CroEvent[] {
  const start = (event: CroEvent) => event.startsAtISO ? zagrebDateKey(new Date(event.startsAtISO)) : event.startDate ?? event.date
  const continuing = (event: CroEvent) => start(event) < day && (event.endDate || event.date) >= day
  const instant = (event: CroEvent) => Date.parse(event.startsAtISO || `${event.date}T${event.time}:00Z`)
  return [...events].sort((a, b) => Number(continuing(a)) - Number(continuing(b))
    || instant(a) - instant(b)
    || a.title.localeCompare(b.title, "hr") || a.slug.localeCompare(b.slug, "hr"))
}

/** Keep existing within-tier poster diversity/rotation on the homepage. */
export function prioritizeFreshEvents(events: CroEvent[], day = zagrebDateKey()): CroEvent[] {
  const continuing = (event: CroEvent) => {
    const start = event.startsAtISO ? zagrebDateKey(new Date(event.startsAtISO)) : event.startDate ?? event.date
    return start < day && (event.endDate || event.date) >= day
  }
  return [...events.filter((event) => !continuing(event)), ...events.filter(continuing)]
}
