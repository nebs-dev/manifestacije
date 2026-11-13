"use client"

import { useState } from "react"
import { Check, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authedFetch } from "@/lib/admin/api"
import type { ParsedCandidate } from "@/lib/admin/types"

export type RailFilter = "pending" | "created" | "ignored" | "all"

export const RAIL_FILTERS: { value: RailFilter; label: string }[] = [
  { value: "pending", label: "Na čekanju" },
  { value: "created", label: "Kreirani" },
  { value: "ignored", label: "Ignorirani" },
  { value: "all", label: "Sve" },
]

/** Fields an editor must supply before an event can be created. */
export function missingOf(candidate: ParsedCandidate): string[] {
  return [
    !candidate.title?.trim() && "naslov",
    !candidate.startsAt && "datum",
    !candidate.city?.trim() && "grad",
    !candidate.category?.trim() && "kategorija",
  ].filter(Boolean) as string[]
}

function statusMark(candidate: ParsedCandidate) {
  if (candidate._status === "created") return <span className="text-success" aria-label="kreiran">✓</span>
  if (candidate._status === "ignored") return <span className="text-muted-foreground" aria-label="ignoriran">—</span>
  return null
}

/**
 * The list of candidates, beside the one being worked on.
 *
 * It replaces a grid of cards that were each collapsed to a title: opening one
 * cost a click before any work could start, and with two cards per row on a
 * wide screen each editor form was squeezed into half the window. Here the
 * list stays narrow and the editor gets the rest.
 *
 * Selection exists for one action only — ignoring several at once. Creating
 * events stays one at a time, in front of an editor, which is the whole point
 * of the queue.
 */
export function CandidateRail({
  candidates,
  activeId,
  onSelect,
  filter,
  onFilterChange,
  counts,
  sourceId,
  onBulkDone,
}: {
  candidates: ParsedCandidate[]
  activeId: string | null
  onSelect: (candidate: ParsedCandidate) => void
  filter: RailFilter
  onFilterChange: (next: RailFilter) => void
  counts: { pending: number; created: number; ignored: number; all: number }
  sourceId: string
  onBulkDone: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const selectable = candidates.filter((c) => c._status !== "created" && c._status !== "ignored")
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.candidateIndex))

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    setConfirming(false)
  }

  async function bulkIgnore() {
    setBusy(true)
    try {
      const res = await authedFetch(`/api/admin/event-sources/${sourceId}/ignore-candidates`, {
        method: "POST",
        body: JSON.stringify({ candidateIndexes: [...selected] }),
      })
      if (res.ok) {
        toast.success(`Ignorirano ${selected.size} kandidata`)
        setSelected(new Set())
        setConfirming(false)
        onBulkDone()
      } else {
        const text = await res.text().catch(() => "")
        let message = text
        try { message = (JSON.parse(text) as { message?: string }).message ?? text } catch { /* plain text */ }
        toast.error("Masovno ignoriranje nije uspjelo", { description: message || undefined })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="candidate-rail">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
        {RAIL_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => onFilterChange(option.value)}
            className={[
              "cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors",
              filter === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {option.label}
            <span className="ml-1 tabular-nums">{counts[option.value]}</span>
          </button>
        ))}
      </div>

      {selectable.length > 0 && (
        <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.candidateIndex)))
              setConfirming(false)
            }}
            className="size-3.5 cursor-pointer rounded border-border accent-primary"
            aria-label="Odaberi sve neobrađene"
          />
          Odaberi sve neobrađene
        </label>
      )}

      {selected.size > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs">
          <span className="font-medium">{selected.size} odabrano</span>
          {confirming ? (
            <div className="flex flex-col gap-2">
              <span className="text-destructive">Ignorirati {selected.size} kandidata?</span>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={bulkIgnore} disabled={busy}>
                  {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
                  Da, ignoriraj
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Ne</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
              <X data-icon="inline-start" />
              Ignoriraj odabrano
            </Button>
          )}
        </div>
      )}

      <ul className="flex max-h-[calc(100vh-14rem)] flex-col gap-1 overflow-y-auto">
        {candidates.map((candidate) => {
          const missing = candidate._status ? [] : missingOf(candidate)
          const active = candidate.id === activeId
          return (
            <li key={candidate.id} className="flex items-start gap-1.5">
              {candidate._status !== "created" && candidate._status !== "ignored" && (
                <input
                  type="checkbox"
                  checked={selected.has(candidate.candidateIndex)}
                  onChange={() => toggle(candidate.candidateIndex)}
                  aria-label={`Odaberi ${candidate.title || "kandidata"}`}
                  className="mt-2 size-3.5 shrink-0 cursor-pointer rounded border-border accent-primary"
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(candidate)}
                aria-current={active ? "true" : undefined}
                className={[
                  "min-w-0 flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-left transition-colors",
                  active ? "border-foreground bg-muted" : "border-transparent hover:bg-muted/50",
                ].join(" ")}
              >
                <span className="flex items-center gap-1.5">
                  {statusMark(candidate)}
                  <span className={["truncate text-xs font-medium", candidate._status ? "text-muted-foreground" : ""].join(" ")}>
                    {candidate.title || "(bez naslova)"}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {[
                    candidate.startsAt ? new Date(candidate.startsAt).toLocaleDateString("hr") : null,
                    candidate.city || null,
                  ].filter(Boolean).join(" · ") || "—"}
                </span>
                {missing.length > 0 && (
                  <span className="mt-0.5 block text-[11px] text-warning">nedostaje: {missing.join(", ")}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
