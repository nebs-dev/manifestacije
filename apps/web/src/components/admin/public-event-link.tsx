"use client"

import Link from "next/link"
import { useState } from "react"
import { ExternalLink, Eye, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { AdminEvent } from "@/lib/admin/types"
import { authedFetch } from "@/lib/admin/api"

type LinkedEvent = Pick<AdminEvent, "id" | "status" | "publishedAt" | "slug">

export function publicEventPath(event: Pick<AdminEvent, "status" | "publishedAt" | "slug">) {
  if (!event.slug || !(event.status === "published" || (event.status === "archived" && event.publishedAt))) return null
  return `/eventi/${encodeURIComponent(event.slug)}`
}

/** An unpublished event has no public page yet, so the preview opens the real
 *  page through a short-lived, admin-issued link instead. */
function DraftPreviewButton({ event }: { event: LinkedEvent }) {
  const [busy, setBusy] = useState(false)

  async function open() {
    if (busy) return
    setBusy(true)
    try {
      const res = await authedFetch(`/api/admin/events/${event.id}/preview-link`, { method: "POST" })
      if (!res.ok) { toast.error("Pregled nije dostupan", { description: await res.text() }); return }
      const { slug, token, expiresInMinutes } = (await res.json()) as { slug: string; token: string; expiresInMinutes: number }
      const url = `/eventi/${encodeURIComponent(slug)}?preview=${encodeURIComponent(token)}`
      // A blocked popup must not look like a silent failure.
      if (!window.open(url, "_blank", "noopener,noreferrer")) window.location.href = url
      else toast.success(`Pregled otvoren u novoj kartici (vrijedi ${expiresInMinutes} min)`)
    } catch {
      toast.error("Pregled nije dostupan")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" /> : <Eye className="size-3.5 shrink-0" aria-hidden="true" />}
      Pregledaj skicu
    </button>
  )
}

export function PublicEventLink({ event }: { event: LinkedEvent }) {
  const href = publicEventPath(event)
  if (href) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />Otvori javnu stranicu
      </Link>
    )
  }
  return event.slug && event.id ? <DraftPreviewButton event={event} /> : null
}
