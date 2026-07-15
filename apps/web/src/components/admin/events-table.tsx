"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Pencil, Search, Trash2 } from "lucide-react"
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

const statusOptions: { value: EventStatus | "all"; label: string }[] = [
  { value: "all", label: "Svi statusi" },
  ...EVENT_STATUS_OPTIONS,
]

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
  onDelete,
}: {
  events: AdminEvent[]
  onDelete?: () => void
}) {
  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [bulkCategoryId, setBulkCategoryId] = useState("")
  const [bulkStatus, setBulkStatus] = useState<string>("")
  const [bulkShiftDays, setBulkShiftDays] = useState("")
  const [organizers, setOrganizers] = useState<{ id: number; name: string }[]>([])
  const [organizerFilter, setOrganizerFilter] = useState<string>("all")

  useEffect(() => {
    authedFetch("/api/admin/categories")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: number; name: string }[]) => setCategories(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    authedFetch("/api/admin/organizers")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: number; name: string }[]) => setOrganizers(data))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let result = status === "all" ? events : events.filter((e) => e.status === status)
    if (organizerFilter !== "all") {
      result = result.filter((e) => e._organizerId === Number(organizerFilter))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q) ||
        (e.categories?.some((c) => c.name.toLowerCase().includes(q)) ?? false) ||
        (e.organizer ?? "").toLowerCase().includes(q)
      )
    }
    return result
  }, [events, status, organizerFilter, search])

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setConfirming(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((e) => e.id)))
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pretraži naziv, grad, kategoriju…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={status} onValueChange={(v) => setStatus(v as string)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="cursor-pointer">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Organizator:</span>
          <Select value={organizerFilter} onValueChange={(v) => setOrganizerFilter(v ?? "all")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Svi organizatori" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all" className="cursor-pointer">Svi organizatori</SelectItem>
                {organizers.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)} className="cursor-pointer">{o.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} događaja
        </span>
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

      {filtered.length === 0 ? (
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
                <TableHead>Naziv</TableHead>
                <TableHead className="whitespace-nowrap">Početak</TableHead>
                <TableHead className="whitespace-nowrap">Kraj</TableHead>
                <TableHead>Grad</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead>Organizator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} className={selected.has(e.id) ? "bg-muted/30" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      className="size-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </TableCell>
                  <TableCell className="max-w-56">
                    <Link href={`/admin/events/${e.id}`} className="block truncate font-medium text-foreground hover:underline">
                      {e.title}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    <InlineDateCell
                      value={e.startsAt}
                      onSave={(iso) => patchEvent(e.id, { startsAt: iso })}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    <InlineDateCell
                      value={e.endsAt}
                      onSave={(iso) => patchEvent(e.id, { endsAt: iso })}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <InlineTextCell
                      value={e.city}
                      onSave={(cityName) => patchEvent(e.id, { cityName })}
                    />
                  </TableCell>
                  <TableCell className="max-w-40">
                    <InlineCategoriesCell
                      categoryIds={e._categoryIds ?? []}
                      categoryNames={(e.categories?.length ? e.categories : e.category ? [{ slug: e.category, name: e.category }] : [])
                        .slice(0, 2)
                        .map((c) => c.name)
                        .join(", ")}
                      allCategories={categories}
                      onSave={(ids) => patchEvent(e.id, { categoryIds: ids })}
                    />
                  </TableCell>
                  <TableCell className="max-w-36">
                    <span className="block truncate text-sm text-muted-foreground">{e.organizer ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <InlineStatusCell
                      status={e.status}
                      onSave={(next) => patchEvent(e.id, { status: toApiEventStatus(next) })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/events/${e.id}`} />}>
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
    </div>
  )
}
