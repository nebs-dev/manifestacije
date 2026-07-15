"use client"

import { useEffect } from "react"
import { trackEvent } from "@/lib/analytics"

/** Fires view_event_detail once on mount. Renders nothing. */
export function EventDetailTracking({ slug, title }: { slug: string; title: string }) {
  useEffect(() => {
    trackEvent({ name: "view_event_detail", params: { event_slug: slug, event_title: title } })
    // Only re-fire if the underlying event actually changes (e.g. client nav
    // between two event detail pages without a full remount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  return null
}
