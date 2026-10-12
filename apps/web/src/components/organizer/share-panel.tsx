"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { eventShareLinks, publicEventUrl } from "@/lib/share-links"

/** Shown to organizers on their published event: public link plus one-click sharing. */
export function OrganizerSharePanel({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false)
  const url = publicEventUrl(slug)
  const share = eventShareLinks(title, url)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked; the link stays visible for manual copying */
    }
  }

  return (
    <section aria-labelledby="share-heading" className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
      <h2 id="share-heading" className="font-heading text-base font-semibold">Događaj je objavljen — podijelite ga</h2>
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 break-all text-sm text-primary hover:underline">
        <ExternalLink className="size-4 shrink-0" aria-hidden />{url}
      </a>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Kopirano" : "Kopiraj poveznicu"}
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={share.facebook} target="_blank" rel="noreferrer" />}>Podijeli na Facebooku</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={share.whatsapp} target="_blank" rel="noreferrer" />}>Pošalji na WhatsApp</Button>
      </div>
    </section>
  )
}
