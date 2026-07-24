"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Columns3, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/admin/status-badge"
import { EmptyState, DeleteButton } from "@/components/admin/states"
import { formatDateTime } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import { EVENT_STATUS_OPTIONS, toApiEventStatus } from "@/lib/admin/status"
import type { AdminEvent, EventStatus } from "@/lib/admin/types"

type DateSortDirection = "asc" | "desc"
type EventSortBy = "startsAt" | "createdAt"
type EventFilters = {
  search: string
  fieldFilters: FieldFilter[]
}
type FieldFilter = { id: string; field: string; op: string; value: string }
type EventColumnKey =
  | "title"
  | "slug"
  | "description"
  | "startsAt"
  | "endsAt"
  | "createdAt"
  | "publishedAt"
  | "allDay"
  | "city"
  | "county"
  | "region"
  | "venue"
  | "address"
  | "category"
  | "categories"
  | "organizer"
  | "isFree"
  | "isFeatured"
  | "priceText"
  | "sourceType"
  | "status"

type FieldKind = "text" | "date" | "number" | "boolean" | "enum"

const EVENT_COLUMNS: Array<{ key: EventColumnKey; label: string; kind: FieldKind; defaultVisible?: boolean }> = [
  { key: "title", label: "Naziv", kind: "text", defaultVisible: true },
  { key: "slug", label: "Slug", kind: "text" },
  { key: "description", label: "Opis", kind: "text" },
  { key: "startsAt", label: "Početak", kind: "date", defaultVisible: true },
  { key: "endsAt", label: "Kraj", kind: "date", defaultVisible: true },
  { key: "createdAt", label: "Dodano", kind: "date", defaultVisible: true },
  { key: "publishedAt", label: "Objavljeno", kind: "date" },
  { key: "allDay", label: "Cijeli dan", kind: "boolean" },
  { key: "city", label: "Grad", kind: "text", defaultVisible: true },
  { key: "county", label: "Županija", kind: "text" },
  { key: "region", label: "Regija", kind: "text" },
  { key: "venue", label: "Mjesto", kind: "text" },
  { key: "address", label: "Adresa", kind: "text" },
  { key: "category", label: "Primarna kategorija", kind: "text" },
  { key: "categories", label: "Kategorije", kind: "text", defaultVisible: true },
  { key: "organizer", label: "Organizator", kind: "text", defaultVisible: true },
  { key: "isFree", label: "Besplatno", kind: "boolean" },
  { key: "isFeatured", label: "Izdvojeno", kind: "boolean" },
  { key: "priceText", label: "Cijena", kind: "text" },
  { key: "sourceType", label: "Tip izvora", kind: "enum" },
  { key: "status", label: "Status", kind: "enum", defaultVisible: true },
]

const DEFAULT_VISIBLE_COLUMNS = EVENT_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.key)

function fieldKind(field: string): FieldKind {
  return EVENT_COLUMNS.find((column) => column.key === field)?.kind ?? "text"
}

function filterOps(kind: FieldKind) {
  if (kind === "date") return [
    { value: "on", label: "na datum" },
    { value: "gte", label: "nakon/od" },
    { value: "lte", label: "prije/do" },
    { value: "empty", label: "prazno" },
    { value: "notEmpty", label: "nije prazno" },
  ]
  if (kind === "number") return [
    { value: "equals", label: "=" },
    { value: "gte", label: "≥" },
    { value: "lte", label: "≤" },
    { value: "empty", label: "prazno" },
    { value: "notEmpty", label: "nije prazno" },
  ]
  if (kind === "boolean") return [
    { value: "equals", label: "je" },
  ]
  return [
    { value: "contains", label: "sadrži" },
    { value: "equals", label: "jednako" },
    { value: "empty", label: "prazno" },
    { value: "notEmpty", label: "nije prazno" },
  ]
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Inline datetime-local cell: click to edit, blur/Enter to save, Escape to cancel.
function InlineDateCell({
  value,
  onSave,
}: {
  value: string | null
  onSave: (iso: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(toLocalInput(value))
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(toLocalInput(value)); setEditing(true) }}
        className="cursor-pointer rounded px-1 py-0.5 text-left text-sm hover:bg-muted"
      >
        {formatDateTime(value)}
      </button>
    )
  }

  async function commit() {
    setSaving(true)
    try {
      await onSave(draft ? new Date(draft).toISOString() : null)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <input
      type="datetime-local"
      autoFocus
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit() }
        if (e.key === "Escape") setEditing(false)
      }}
      className="w-full rounded border border-input bg-card px-1.5 py-1 text-sm outline-none ring-ring/40 focus:ring-2"
    />
  )
}

// Inline free-text cell (used for city name): click to edit, blur/Enter to save.
function InlineTextCell({
  value,
  placeholder = "—",
  onSave,
}: {
  value: string | null
  placeholder?: string
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value ?? ""); setEditing(true) }}
        className="block w-full cursor-pointer whitespace-nowrap rounded px-1 py-0.5 text-left text-sm hover:bg-muted"
      >
        {value || placeholder}
      </button>
    )
  }

  async function commit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === value) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(trimmed)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <input
      type="text"
      autoFocus
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit() }
        if (e.key === "Escape") setEditing(false)
      }}
      className="w-32 rounded border border-input bg-card px-1.5 py-1 text-sm outline-none ring-ring/40 focus:ring-2"
    />
  )
}

function InlineStatusCell({
  status,
  onSave,
}: {
  status: EventStatus
  onSave: (status: EventStatus) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  return (
    <Select
      value={status}
      onValueChange={async (v) => {
        if (!v || v === status) return
        setSaving(true)
        try { await onSave(v as EventStatus) } finally { setSaving(false) }
      }}
    >
      <SelectTrigger className="h-7 border-transparent bg-transparent px-1 hover:border-input disabled:opacity-100" disabled={saving}>
        <SelectValue>
          <StatusBadge status={status} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {EVENT_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="cursor-pointer">
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function InlineCategoriesCell({
  categoryIds,
  categoryNames,
  allCategories,
  onSave,
}: {
  categoryIds: number[]
  categoryNames: string
  allCategories: { id: number; name: string }[]
  onSave: (ids: number[]) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Set<number>>(new Set(categoryIds))
  const [saving, setSaving] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft(new Set(categoryIds))
      }}
    >
      <PopoverTrigger
        render={
          <button type="button" className="block max-w-40 cursor-pointer truncate rounded px-1 py-0.5 text-left text-sm hover:bg-muted" />
        }
      >
        {categoryNames || "—"}
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {allCategories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={draft.has(c.id)}
                onChange={() => {
                  setDraft((prev) => {
                    const next = new Set(prev)
                    next.has(c.id) ? next.delete(c.id) : next.add(c.id)
                    return next
                  })
                }}
                className="size-3.5 rounded border-input accent-primary"
              />
              {c.name}
            </label>
          ))}
        </div>
        <div className="mt-2 flex justify-end gap-1.5 border-t border-border pt-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            Odustani
          </Button>
          <Button
            size="sm"
            disabled={saving || draft.size === 0}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave([...draft])
                setOpen(false)
              } finally {
                setSaving(false)
              }
            }}
          >
            Spremi
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function EventsTable({
  events,
  loading,
  onDelete,
  dateSort,
  onDateSortChange,
  sortBy,
  onSortByChange,
  filters,
  onFiltersChange,
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  events: AdminEvent[]
  loading?: boolean
  onDelete?: () => void
  dateSort: DateSortDirection
  onDateSortChange: (direction: DateSortDirection) => void
  sortBy: EventSortBy
  onSortByChange: (sortBy: EventSortBy) => void
  filters: EventFilters
  onFiltersChange: (filters: EventFilters) => void
  pagination: { page: number; pageSize: number; total: number }
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [bulkCategoryId, setBulkCategoryId] = useState("")
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [bulkShiftDays, setBulkShiftDays] = useState("")
  const [searchDraft, setSearchDraft] = useState(filters.search)
  const [visibleColumns, setVisibleColumns] = useState<EventColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("admin-events-visible-columns")
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const allowed = new Set(EVENT_COLUMNS.map((column) => column.key))
      const next = parsed.filter((key): key is EventColumnKey => typeof key === "string" && allowed.has(key as EventColumnKey))
      if (next.length) setVisibleColumns(next)
    } catch {
      // Ignore corrupted local UI preferences.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem("admin-events-visible-columns", JSON.stringify(visibleColumns))
    } catch {
      // Ignore unavailable localStorage.
    }
  }, [visibleColumns])

  useEffect(() => {
    authedFetch("/api/admin/categories")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: number; name: string }[]) => setCategories(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => events.some((event) => event.id === id))))
  }, [events])

  const updateFilters = useCallback((patch: Partial<EventFilters>) => {
    onFiltersChange({ ...filters, ...patch })
    setConfirming(false)
  }, [filters, onFiltersChange])

  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchDraft !== filters.search) updateFilters({ search: searchDraft })
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [filters.search, searchDraft, updateFilters])

  const allSelected = events.length > 0 && events.every((e) => selected.has(e.id))

  function toggleSort(nextSortBy: EventSortBy) {
    if (sortBy === nextSortBy) {
      onDateSortChange(dateSort === "asc" ? "desc" : "asc")
      return
    }
    onSortByChange(nextSortBy)
  }

  function sortArrow(column: EventSortBy) {
    return sortBy === column ? (dateSort === "asc" ? "↑" : "↓") : ""
  }

  function toggleColumn(column: EventColumnKey) {
    setVisibleColumns((prev) => {
      if (prev.includes(column)) {
        if (prev.length === 1) return prev
        return prev.filter((key) => key !== column)
      }
      return [...prev, column]
    })
  }

  function updateFieldFilter(id: string, patch: Partial<FieldFilter>) {
    updateFilters({
      fieldFilters: filters.fieldFilters.map((filter) => {
        if (filter.id !== id) return filter
        const next = { ...filter, ...patch }
        if (patch.field && patch.field !== filter.field) {
          const kind = fieldKind(patch.field)
          next.op = filterOps(kind)[0]?.value ?? "contains"
          next.value = ""
        }
        return next
      }),
    })
  }

  function addFieldFilter() {
    updateFilters({
      fieldFilters: [
        ...filters.fieldFilters,
        { id: `filter-${Date.now()}`, field: "title", op: "contains", value: "" },
      ],
    })
  }

  function removeFieldFilter(id: string) {
    updateFilters({ fieldFilters: filters.fieldFilters.filter((filter) => filter.id !== id) })
  }

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.fieldFilters.length,
  )

  const returnTo = (() => {
    const params = new URLSearchParams({ sortBy, sortDir: dateSort, page: String(pagination.page), pageSize: String(pagination.pageSize) })
    if (filters.search.trim()) params.set("search", filters.search.trim())
    if (filters.fieldFilters.length) params.set("fieldFilters", JSON.stringify(filters.fieldFilters))
    return `/admin/events?${params.toString()}`
  })()

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setConfirming(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(events.map((e) => e.id)))
    setConfirming(false)
  }

  async function bulkDelete() {
    setBulkBusy(true)
    const results = await Promise.all(
      [...selected].map((id) => authedFetch(`/api/admin/events/${id}`, { method: "DELETE" }))
    )
    setBulkBusy(false)
    const failed = results.filter((r) => !r.ok).length
    if (failed === 0) toast.success(`Obrisano ${results.length} događaja`)
    else toast.warning(`${results.length - failed} obrisano, ${failed} nije uspjelo`)
    setSelected(new Set())
    setConfirming(false)
    onDelete?.()
  }

  async function bulkAssignCategory(action: "add" | "remove") {
    if (!bulkCategoryId) { toast.error("Odaberite kategoriju"); return }
    setBulkBusy(true)
    const res = await authedFetch("/api/admin/events/bulk-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds: [...selected].map(Number), categoryId: Number(bulkCategoryId), action }),
    })
    setBulkBusy(false)
    if (res.ok) {
      toast.success(action === "add" ? "Kategorija dodana" : "Kategorija uklonjena")
      setSelected(new Set())
      onDelete?.()
    } else {
      toast.error("Greška pri promjeni kategorija")
    }
  }

  async function bulkApplyStatus() {
    if (!bulkStatus) { toast.error("Odaberite status"); return }
    setBulkBusy(true)
    const res = await authedFetch("/api/admin/events/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds: [...selected].map(Number), status: toApiEventStatus(bulkStatus as EventStatus) }),
    })
    setBulkBusy(false)
    if (res.ok) {
      toast.success("Status promijenjen")
      setSelected(new Set())
      onDelete?.()
    } else {
      toast.error("Greška pri promjeni statusa")
    }
  }

  async function bulkApplyShiftDates() {
    const days = Number(bulkShiftDays)
    if (!Number.isFinite(days) || days === 0) { toast.error("Unesite broj dana (npr. 7 ili -3)"); return }
    setBulkBusy(true)
    const res = await authedFetch("/api/admin/events/bulk-shift-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds: [...selected].map(Number), days }),
    })
    setBulkBusy(false)
    if (res.ok) {
      toast.success(`Datumi pomaknuti za ${days} dana`)
      setSelected(new Set())
      setBulkShiftDays("")
      onDelete?.()
    } else {
      toast.error("Greška pri pomicanju datuma")
    }
  }

  async function deleteEvent(id: string, title: string) {
    const res = await authedFetch(`/api/admin/events/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success(`Obrisano: ${title}`)
      setSelected((p) => { const n = new Set(p); n.delete(id); return n })
      onDelete?.()
    } else {
      toast.error("Greška pri brisanju")
    }
  }

  async function patchEvent(id: string, body: Record<string, unknown>) {
    const res = await authedFetch(`/api/admin/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      onDelete?.()
    } else {
      toast.error("Greška pri spremanju", { description: await res.text() })
    }
  }

  function categoryNames(event: AdminEvent) {
    return (event.categories?.length ? event.categories : event.category ? [{ slug: event.category, name: event.category }] : [])
      .map((c) => c.name)
      .join(", ")
  }

  function displayValue(event: AdminEvent, column: EventColumnKey) {
    switch (column) {
      case "title": return event.title
      case "slug": return event.slug
      case "description": return event.description
      case "startsAt": return formatDateTime(event.startsAt)
      case "endsAt": return formatDateTime(event.endsAt)
      case "createdAt": return formatDateTime(event.createdAt)
      case "publishedAt": return formatDateTime(event.publishedAt)
      case "allDay": return event.allDay ? "Da" : "Ne"
      case "city": return event.city ?? "—"
      case "county": return event.county ?? "—"
      case "region": return event.region ?? "—"
      case "venue": return event.venue ?? "—"
      case "address": return event.address ?? "—"
      case "category": return event.category ?? "—"
      case "categories": return categoryNames(event) || "—"
      case "organizer": return event.organizer ?? "—"
      case "isFree": return event.isFree ? "Da" : "Ne"
      case "isFeatured": return event.isFeatured ? "Da" : "Ne"
      case "priceText": return event.priceText ?? "—"
      case "sourceType": return event.sourceType ?? "—"
      case "status": return event.status
      default: return "—"
    }
  }

  function renderCell(event: AdminEvent, column: EventColumnKey) {
    if (column === "title") {
      return (
        <Link href={`/admin/events/${event.id}?returnTo=${encodeURIComponent(returnTo)}`} className="block truncate font-medium text-foreground hover:underline">
          {event.title}
        </Link>
      )
    }
    if (column === "startsAt") {
      return <InlineDateCell value={event.startsAt} onSave={(iso) => patchEvent(event.id, { startsAt: iso })} />
    }
    if (column === "endsAt") {
      return <InlineDateCell value={event.endsAt} onSave={(iso) => patchEvent(event.id, { endsAt: iso })} />
    }
    if (column === "city") {
      return <InlineTextCell value={event.city} onSave={(cityName) => patchEvent(event.id, { cityName })} />
    }
    if (column === "categories") {
      return (
        <InlineCategoriesCell
          categoryIds={event._categoryIds ?? []}
          categoryNames={categoryNames(event)}
          allCategories={categories}
          onSave={(ids) => patchEvent(event.id, { categoryIds: ids })}
        />
      )
    }
    if (column === "status") {
      return <InlineStatusCell status={event.status} onSave={(next) => patchEvent(event.id, { status: toApiEventStatus(next) })} />
    }
    const value = displayValue(event, column)
    const text = String(value)
    const isLong = ["description", "address", "ticketUrl", "sourceUrl", "imageUrl", "slug"].includes(column)
    return <span className={isLong ? "block max-w-64 truncate text-sm text-muted-foreground" : "whitespace-nowrap text-sm text-muted-foreground"}>{text}</span>
  }

  function renderHead(column: EventColumnKey) {
    if (column === "startsAt" || column === "createdAt") {
      const sortColumn = column
      return (
        <button
          type="button"
          onClick={() => toggleSort(sortColumn)}
          className="inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted"
          aria-label={`Sortiraj po datumu ${dateSort === "asc" ? "silazno" : "uzlazno"}`}
        >
          {EVENT_COLUMNS.find((item) => item.key === column)?.label} <span aria-hidden>{sortArrow(sortColumn)}</span>
        </button>
      )
    }
    return EVENT_COLUMNS.find((item) => item.key === column)?.label ?? column
  }

  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const pageEnd = Math.min(pagination.total, pagination.page * pagination.pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pretraži naziv, grad, kategoriju…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="w-72 pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <Select value={sortBy} onValueChange={(v) => { if (v) onSortByChange(v as EventSortBy) }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="startsAt" className="cursor-pointer">Datum događaja</SelectItem>
                <SelectItem value="createdAt" className="cursor-pointer">Datum dodavanja</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            <Columns3 data-icon="inline-start" />
            Kolone
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Prikaži polja</span>
              <Button variant="ghost" size="xs" onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}>
                Reset
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {EVENT_COLUMNS.map((column) => (
                <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                    className="size-3.5 rounded border-input accent-primary"
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Učitavanje…" : `${pagination.total} događaja`}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filter po bilo kojem polju</span>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFiltersChange({ search: "", fieldFilters: [] })}
              >
                Očisti filtere
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={addFieldFilter}>
              <Plus data-icon="inline-start" />
              Dodaj filter
            </Button>
          </div>
        </div>
        {filters.fieldFilters.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filters.fieldFilters.map((filter) => {
              const kind = fieldKind(filter.field)
              const ops = filterOps(kind)
              const opNeedsValue = filter.op !== "empty" && filter.op !== "notEmpty"
              return (
                <div key={filter.id} className="flex flex-wrap items-center gap-2">
                  <Select value={filter.field} onValueChange={(v) => { if (v) updateFieldFilter(filter.id, { field: v }) }}>
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {EVENT_COLUMNS.map((column) => (
                          <SelectItem key={column.key} value={column.key} className="cursor-pointer">
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select value={filter.op} onValueChange={(v) => { if (v) updateFieldFilter(filter.id, { op: v }) }}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ops.map((op) => (
                          <SelectItem key={op.value} value={op.value} className="cursor-pointer">
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {opNeedsValue && kind === "boolean" ? (
                    <Select value={filter.value || "true"} onValueChange={(v) => { if (v) updateFieldFilter(filter.id, { value: v }) }}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="true">Da</SelectItem>
                          <SelectItem value="false">Ne</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : opNeedsValue ? (
                    <Input
                      type={kind === "date" ? "date" : kind === "number" ? "number" : "text"}
                      value={filter.value}
                      onChange={(e) => updateFieldFilter(filter.id, { value: e.target.value })}
                      placeholder="Vrijednost"
                      className="w-56"
                    />
                  ) : null}
                  <Button variant="ghost" size="icon-sm" onClick={() => removeFieldFilter(filter.id)} aria-label="Ukloni filter">
                    <X className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Dodaj filter za title, slug, opis, datum, cijenu, status, lokaciju, ID-eve i ostala event polja.</p>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} odabrano</span>

          <div className="flex items-center gap-2">
            <Select value={bulkCategoryId} onValueChange={(v) => setBulkCategoryId(v ?? "")}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Odaberi kategoriju" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => bulkAssignCategory("add")} disabled={bulkBusy || !bulkCategoryId}>
              + Dodaj
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkAssignCategory("remove")} disabled={bulkBusy || !bulkCategoryId}>
              − Ukloni
            </Button>
          </div>

          <div className="flex items-center gap-2 border-l border-border pl-3">
            <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v ?? "")}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Odaberi status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {EVENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={bulkApplyStatus} disabled={bulkBusy || !bulkStatus}>
              Postavi status
            </Button>
          </div>

          <div className="flex items-center gap-2 border-l border-border pl-3">
            <Input
              type="number"
              placeholder="±dani"
              value={bulkShiftDays}
              onChange={(e) => setBulkShiftDays(e.target.value)}
              className="h-8 w-20 text-xs"
            />
            <Button variant="outline" size="sm" onClick={bulkApplyShiftDates} disabled={bulkBusy || !bulkShiftDays}>
              Pomakni datume
            </Button>
          </div>

          <div className="flex items-center gap-2 border-l border-border pl-3">
            {confirming ? (
              <>
                <span className="text-destructive">Sigurno obrisati {selected.size} događaja?</span>
                <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkBusy}>
                  Da, obriši
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Ne
                </Button>
              </>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
                <Trash2 data-icon="inline-start" />
                Obriši
              </Button>
            )}
          </div>

          <button onClick={() => { setSelected(new Set()); setConfirming(false) }} className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground">
            Odustani
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState
          title="Nema događaja"
          description="Nijedan događaj ne odgovara odabranom filtru."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 cursor-pointer rounded border-border accent-primary"
                  />
                </TableHead>
                {visibleColumns.map((column) => (
                  <TableHead key={column} className="whitespace-nowrap">{renderHead(column)}</TableHead>
                ))}
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} className={selected.has(e.id) ? "bg-muted/30" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      className="size-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell key={column} className={column === "title" ? "max-w-56" : column === "categories" ? "max-w-44" : undefined}>
                      {renderCell(e, column)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/events/${e.id}?returnTo=${encodeURIComponent(returnTo)}`} />}>
                        <Pencil data-icon="inline-start" />
                        Uredi
                      </Button>
                      <DeleteButton onDelete={() => deleteEvent(e.id, e.title)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {pagination.total === 0 ? "Nema rezultata" : `Prikaz ${pageStart}–${pageEnd} od ${pagination.total}`}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pagination.pageSize)} onValueChange={(v) => { if (v) onPageSizeChange(Number(v)) }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>{size} / str.</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={pagination.page <= 1 || loading} onClick={() => onPageChange(pagination.page - 1)}>
            Prethodna
          </Button>
          <span className="text-sm text-muted-foreground">
            {pagination.page} / {pageCount}
          </span>
          <Button variant="outline" disabled={pagination.page >= pageCount || loading} onClick={() => onPageChange(pagination.page + 1)}>
            Sljedeća
          </Button>
        </div>
      </div>
    </div>
  )
}
