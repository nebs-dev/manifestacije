import { sendGAEvent } from "@next/third-parties/google"

// GA4 event names and params used across the monetization plan's measurement
// checklist. Keeping them here (instead of inline sendGAEvent calls scattered
// through components) means every call site sends the same param shape, so
// GA4 exploration reports and the pilot report template can rely on a fixed
// schema.
type AnalyticsEvent =
  | { name: "view_event_detail"; params: { event_slug: string; event_title: string } }
  | { name: "click_ticket_or_source"; params: { event_slug: string; event_title: string; url: string } }
  | { name: "click_map_or_directions"; params: { event_slug: string; event_title: string } }
  | { name: "share_event"; params: { event_slug: string; event_title: string; method: "native_share" | "copy_link" } }
  | { name: "newsletter_signup"; params: { location: string } }
  | { name: "submit_event_started"; params: { method: "manual" | "url" } }
  | { name: "submit_event_completed"; params: { method: "manual" | "url" } }
  | { name: "organizer_registered"; params: Record<string, never> }

export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return
  sendGAEvent("event", event.name, event.params)
}
