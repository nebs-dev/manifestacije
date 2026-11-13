"use client"

import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * The inbox filter for /admin/sources.
 *
 * The queue is append-only and interleaves three kinds of source, so by the
 * time it held 928 rows "what still needs me?" meant paging through 38 pages.
 * The default here is therefore not "everything": it opens on the rows that
 * still hold an undecided candidate, and says so, with one click back to the
 * full list.
 */

export type SourceFilter = {
  /** An EventSourceType, or "" for every kind. */
  type: "" | "SCRAPE_DISCOVERY" | "EMAIL" | "URL" | "MANUAL"
  /** An EventSourceStatus, or "" for every status. */
  status: "" | "NEW" | "PARSED" | "NEEDS_REVIEW" | "LINKED" | "FAILED"
  /** Only rows holding at least one candidate nobody has decided on. */
  actionable: boolean
  /** Only rows this admin has never opened. */
  unviewed: boolean
  q: string
}

export const DEFAULT_SOURCE_FILTER: SourceFilter = { type: "", status: "", actionable: true, unviewed: false, q: "" }

const TYPES: { value: SourceFilter["type"]; label: string }[] = [
  { value: "", label: "Svi tipovi" },
  { value: "SCRAPE_DISCOVERY", label: "Nadzirani izvori" },
  { value: "EMAIL", label: "E-mail / ručno" },
  { value: "URL", label: "Poveznice" },
]

/**
 * Row status, which answers a different question from "is anything undecided":
 * NEEDS_REVIEW is the parser saying it is unsure, FAILED is a check that did
 * not finish. Both are worth going to directly, and neither was reachable
 * without paging. The backend already filters on this column — see
 * `eventSourceListWhere` — so this adds a control, not a second source of
 * truth.
 */
const STATUSES: { value: SourceFilter["status"]; label: string }[] = [
  { value: "", label: "Svi statusi" },
  { value: "NEEDS_REVIEW", label: "Treba pregled" },
  { value: "PARSED", label: "Obrađeno" },
  { value: "NEW", label: "Novo" },
  { value: "FAILED", label: "Neuspjelo" },
]

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

export function SourceFilters({
  value,
  onChange,
  total,
}: {
  value: SourceFilter
  onChange: (next: SourceFilter) => void
  total: number
}) {
  const isDefault =
    value.type === DEFAULT_SOURCE_FILTER.type &&
    value.status === DEFAULT_SOURCE_FILTER.status &&
    value.actionable === DEFAULT_SOURCE_FILTER.actionable &&
    value.unviewed === DEFAULT_SOURCE_FILTER.unviewed &&
    value.q === ""

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((option) => (
          <Chip
            key={option.value || "all"}
            active={value.type === option.value}
            onClick={() => onChange({ ...value, type: option.value })}
          >
            {option.label}
          </Chip>
        ))}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <label className="sr-only" htmlFor="source-status-filter">Status izvora</label>
        <select
          id="source-status-filter"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as SourceFilter["status"] })}
          className="cursor-pointer rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground"
        >
          {STATUSES.map((option) => (
            <option key={option.value || "all"} value={option.value}>{option.label}</option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <Chip
          active={value.actionable}
          onClick={() => onChange({ ...value, actionable: !value.actionable, unviewed: value.actionable ? false : value.unviewed })}
        >
          Samo neobrađeni
        </Chip>
        <Chip
          active={value.unviewed}
          // Unviewed is a subset of actionable; turning it on turns that on too
          // so the counts in the table cannot contradict the chips.
          onClick={() => onChange({ ...value, unviewed: !value.unviewed, actionable: value.unviewed ? value.actionable : true })}
        >
          Nikad otvoreni
        </Chip>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value.q}
              onChange={(event) => onChange({ ...value, q: event.target.value })}
              placeholder="Traži po URL-u, predmetu ili organizatoru"
              aria-label="Traži izvore"
              className="w-72 pl-8"
            />
          </div>
          {!isDefault && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_SOURCE_FILTER })}>
              <X data-icon="inline-start" />
              Očisti
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="source-filter-summary">
        {value.actionable
          ? `${total} izvor(a) čeka obradu${value.unviewed ? ", nikad otvoreno" : ""}`
          : `${total} izvor(a) ukupno`}
        {value.actionable && (
          <button
            type="button"
            onClick={() => onChange({ ...value, actionable: false, unviewed: false })}
            className="ml-2 cursor-pointer underline hover:text-foreground"
          >
            Prikaži i obrađene
          </button>
        )}
      </p>
    </div>
  )
}
