import { sendGAEvent } from "@next/third-parties/google"

export type DiscoveryDestination = "/kalendar" | "/mapa" | "/ovaj-vikend"
export type DiscoverySourceComponent =
  | "hero_quick_link"
  | "calendar_teaser"
  | "map_teaser"
  | "quick_filter"
  | "navigation"

type DiscoveryParams = {
  source_page: string
  source_component: DiscoverySourceComponent
  destination: DiscoveryDestination
}

// GA4 event names and params used across the monetization plan's measurement
// checklist. Keeping them here (instead of inline sendGAEvent calls scattered
// through components) means every call site sends the same param shape, so
// GA4 exploration reports and the pilot report template can rely on a fixed
// schema.
type AnalyticsEvent =
  | { name: "home_search"; params: { has_text: boolean; has_city: boolean } }
  | { name: "filter_change"; params: { source_page: string; filter: string; action: "apply" | "remove" } }
  | { name: "filter_reset"; params: { source_page: string } }
  | { name: "calendar_date_select"; params: { view: string } }
  | { name: "map_city_search"; params: { result_count: number } }
  | { name: "related_event_click"; params: { event_slug: string } }
  | { name: "view_event_detail"; params: { event_slug: string; event_title: string } }
  | { name: "click_ticket_or_source"; params: { event_slug: string; event_title: string; url: string } }
  | { name: "click_map_or_directions"; params: { event_slug: string; event_title: string } }
  | { name: "share_event"; params: { event_slug: string; event_title: string; method: "native_share" | "copy_link" } }
  | { name: "calendar_clicked"; params: { event_slug: string; event_title: string } }
  | { name: "calendar_provider_selected"; params: { event_slug: string; event_title: string; provider: "google" | "ics" } }
  | { name: "newsletter_signup"; params: { location: string } }
  | { name: "submit_event_started"; params: { method: "manual" | "url" } }
  | { name: "submit_event_completed"; params: { method: "manual" | "url" } }
  | { name: "organizer_registered"; params: Record<string, never> }
  | { name: "calendar_click"; params: DiscoveryParams }
  | { name: "map_click"; params: DiscoveryParams }
  | { name: "weekend_click"; params: DiscoveryParams }

export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return
  try {
    sendGAEvent("event", event.name, event.params)
  } catch {
    // Analytics must never block navigation or another primary user action.
  }
}

export function trackDiscoveryNavigation(params: DiscoveryParams): void {
  if (params.destination === "/kalendar") {
    trackEvent({ name: "calendar_click", params })
  } else if (params.destination === "/mapa") {
    trackEvent({ name: "map_click", params })
  } else {
    trackEvent({ name: "weekend_click", params })
  }
}

export function analyticsSourcePage(pathname: string | null): string {
  return pathname === "/" ? "home" : pathname || "unknown"
}
