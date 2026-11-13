"use client"

import { useState } from "react"
import Image from "next/image"
import { ExternalLink, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { safeExternalUrl } from "@/lib/safe-url"
import type { EventSource } from "@/lib/admin/types"

/**
 * What the source actually said, beside the fields it was turned into.
 *
 * Before this, the evidence lived in two collapsed cards above the candidate
 * list: checking a parsed date meant scrolling up, opening "Neobrađeni tekst
 * izvora", reading, holding the date in mind, and scrolling back down. The
 * measured walkthrough spent 20 256 px of scrolling on six candidates, and the
 * first candidate began 1 697 px below the top of a 900 px screen.
 *
 * So it is a column, sticky, next to the editor. The search box is here for
 * the same reason: on a listing page the raw text is thousands of characters
 * and the editor wants the two lines about *this* event.
 */
/** Lines around each hit, in source order, with gaps marked. */
export function withContext(lines: string[], hits: number[], around = 3): string[] {
  const keep = new Set<number>()
  for (const hit of hits) {
    for (let i = Math.max(0, hit - around); i <= Math.min(lines.length - 1, hit + around); i++) keep.add(i)
  }
  const ordered = [...keep].sort((a, b) => a - b)
  const out: string[] = []
  let previous = -1
  for (const index of ordered) {
    if (previous !== -1 && index > previous + 1) out.push("…")
    out.push(lines[index])
    previous = index
  }
  return out
}

export function SourceEvidence({ source, highlight }: { source: EventSource; highlight?: string }) {
  const [query, setQuery] = useState("")
  const images = source.sourceImageSrcs?.length
    ? source.sourceImageSrcs
    : [safeExternalUrl(source.sourceImageUrl) ?? source.pendingScreenshotSrc].filter((src): src is string => Boolean(src))
  const url = safeExternalUrl(source.sourceUrl)

  // Default to the active candidate's own title: nine times in ten that is the
  // line the editor is looking for, and typing it again is work.
  const needle = (query || highlight || "").trim()
  const lines = (source.rawText ?? "").split(/\r?\n/)
  const hits = needle
    ? lines.flatMap((line, index) => (line.toLowerCase().includes(needle.toLowerCase()) ? [index] : []))
    : []
  // A hit on its own is almost never the answer: the title matches and the
  // date, the place and the price are the lines under it. Keep a few lines
  // around each hit, and mark where a jump in the source was cut out.
  const shown = hits.length ? withContext(lines, hits) : lines

  return (
    <aside
      aria-label="Izvor"
      data-testid="source-evidence"
      className="flex max-h-[calc(100vh-7rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3 xl:sticky xl:top-20"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">Izvor</h3>
        {url && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={url} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" />
            Otvori
          </Button>
        )}
      </div>

      {images.length > 0 && (
        <ul className="flex flex-col gap-2">
          {images.slice(0, 3).map((src, index) => (
            <li key={src.slice(0, 120) + index} className="flex flex-col gap-1">
              <Image
                src={src}
                alt={`Slika izvora ${index + 1}`}
                width={900}
                height={700}
                unoptimized
                className="h-auto max-h-64 w-full rounded-lg border border-border object-contain"
              />
              {/* A poster is often unreadable at column width; the link opens
                  it full size. An inline data: URL has nowhere to open. */}
              {!src.startsWith("data:") && (
                <a href={src} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  Otvori sliku {index + 1}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {source.rawText ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={highlight ? `Traži (sada: naslov kandidata)` : "Traži u tekstu izvora"}
              aria-label="Traži u tekstu izvora"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {needle
              ? hits.length
                ? `${hits.length} podudaranje(a) za „${needle}”, s okolnim redcima`
                : `Nema podudaranja za „${needle}” — prikazan je cijeli tekst`
              : `${lines.length} redaka izvornog teksta`}
          </p>
          <pre
            data-testid="source-evidence-text"
            className="min-h-24 flex-1 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground"
          >
            {shown.join("\n")}
          </pre>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ovaj izvor nema spremljen tekst. Otvorite poveznicu iznad da vidite original.
        </p>
      )}
    </aside>
  )
}
