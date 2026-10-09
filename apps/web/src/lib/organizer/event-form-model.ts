import { safeExternalUrl } from "@/lib/safe-url"

type ScheduleItem = { id?: number; startsAt: string; endsAt: string | null; isAllDay: boolean }

/**
 * Optional organizer fields are sent as explicit `null` when cleared.
 * `undefined` would be dropped by JSON.stringify and the API would keep the
 * old value (EVT-06). While the event is free the price and ticket inputs are
 * hidden, so those two keys are omitted and the stored values stay as they are.
 */
export function buildOrganizerEventBody(input: {
  schedule: ScheduleItem[]
  sendOccurrences: boolean
  isFree: boolean
  priceText: string
  ticketUrl: string
  sourceUrl: string
  imageUrl: string
}) {
  const first = input.schedule[0]
  return {
    startsAt: first.startsAt,
    endsAt: first.endsAt ?? null,
    isAllDay: first.isAllDay,
    occurrences: input.sendOccurrences ? input.schedule : undefined,
    isFree: input.isFree,
    ...(input.isFree ? {} : {
      priceText: input.priceText.trim() || null,
      ticketUrl: input.ticketUrl.trim() || null,
    }),
    sourceUrl: input.sourceUrl.trim() || null,
    imageUrl: input.imageUrl || null,
  }
}

/** True when the field still holds a stored value that is not a valid link
 *  (it is never rendered as a link; the organizer should fix or clear it). */
export function invalidLegacyUrl(value: string, initial: string | null | undefined, allowContactLinks = false) {
  const trimmed = value.trim()
  return Boolean(trimmed && initial && trimmed === initial.trim() && !safeExternalUrl(trimmed, { allowContactLinks }))
}

/** Croatian error for a new/changed link that the API would reject; an
 *  unchanged legacy value is allowed through so unrelated edits can be saved. */
export function organizerUrlError(
  values: { ticketUrl?: string; sourceUrl: string },
  initial?: { ticketUrl?: string | null; sourceUrl?: string | null },
) {
  const changedAndInvalid = (value: string | undefined, stored: string | null | undefined, allowContactLinks: boolean) => {
    const trimmed = value?.trim()
    if (!trimmed || trimmed === stored?.trim()) return false
    return !safeExternalUrl(trimmed, { allowContactLinks })
  }
  if (changedAndInvalid(values.ticketUrl, initial?.ticketUrl, true)) {
    return "Link za ulaznice mora biti web adresa (npr. https://www.entrio.hr/…), tel: ili mailto: poveznica."
  }
  if (changedAndInvalid(values.sourceUrl, initial?.sourceUrl, false)) {
    return "Poveznica na događaj mora biti web adresa (npr. https://…)."
  }
  return null
}
