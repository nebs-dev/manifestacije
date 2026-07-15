"use client"

import { ExternalLink, Map, Ticket } from "lucide-react"
import { trackEvent } from "@/lib/analytics"

export function TicketLink({
  href,
  slug,
  title,
  free,
}: {
  href: string
  slug: string
  title: string
  free: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent({ name: "click_ticket_or_source", params: { event_slug: slug, event_title: title, url: href } })}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Ticket className="size-4" aria-hidden /> {free ? "Rezerviraj mjesto" : "Kupi ulaznicu"} <ExternalLink className="size-3.5" aria-hidden />
    </a>
  )
}

export function MapLink({ href, slug, title }: { href: string; slug: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent({ name: "click_map_or_directions", params: { event_slug: slug, event_title: title } })}
      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <Map className="size-3" /> Otvori kartu
    </a>
  )
}
