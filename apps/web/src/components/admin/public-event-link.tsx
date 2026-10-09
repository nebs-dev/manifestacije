import Link from "next/link"
import { ExternalLink } from "lucide-react"
import type { AdminEvent } from "@/lib/admin/types"

export function publicEventPath(event: Pick<AdminEvent, "status" | "publishedAt" | "slug">) {
  if (!event.slug || !(event.status === "published" || (event.status === "archived" && event.publishedAt))) return null
  return `/eventi/${encodeURIComponent(event.slug)}`
}

export function PublicEventLink({ event }: { event: Pick<AdminEvent, "status" | "publishedAt" | "slug"> }) {
  const href = publicEventPath(event)
  return href ? <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
    <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />Otvori javnu stranicu
  </Link> : null
}
