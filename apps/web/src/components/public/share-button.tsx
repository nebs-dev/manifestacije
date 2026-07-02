"use client"

import { useState } from "react"
import { Share2, Check } from "lucide-react"

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = [title, url].filter(Boolean).join("\n")
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={onShare}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {copied ? "Kopirano" : "Podijeli"}
    </button>
  )
}
