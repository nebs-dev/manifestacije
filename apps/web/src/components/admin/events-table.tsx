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
import { EVENT_STATUS_OPTIONS } from "@/lib/admin/status"
import type { AdminEvent, EventStatus } from "@/lib/admin/types"

const statusOptions: { value: EventStatus | "all"; label: string }[] = [
  { value: "all", label: "Svi statusi" },
  ...EVENT_STATUS_OPTIONS,
]

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

  useEffect(() => {
    authedFetch("/api/admin/categories")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: number; name: string }[]) => setCategories(data))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let result = status === "all" ? events : events.filter((e) => e.status === status)
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q) ||
        (e.categories?.some((c) => c.name.toLowerCase().includes(q)) ?? false)
      )
    }
    return result
  }, [events, status, search])

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
        <Select value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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

          <div className="flex items-center gap-2">
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
                    {formatDateTime(e.startsAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{e.city ?? "—"}</TableCell>
                  <TableCell className="max-w-40">
                    <span className="block truncate text-sm">
                      {(e.categories?.length ? e.categories : e.category ? [{ slug: e.category, name: e.category }] : [])
                        .slice(0, 2)
                        .map((c) => c.name)
                        .join(", ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-36">
                    <span className="block truncate text-sm text-muted-foreground">{e.organizer ?? "—"}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
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
