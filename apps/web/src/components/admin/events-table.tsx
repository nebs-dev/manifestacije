"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Pencil, Search } from "lucide-react"
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

  async function deleteEvent(id: string, title: string) {
    const res = await authedFetch(`/api/admin/events/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success(`Obrisano: ${title}`)
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
                <TableHead>Naziv</TableHead>
                <TableHead className="whitespace-nowrap">Početak</TableHead>
                <TableHead>Grad</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[260px]">
                    <Link
                      href={`/admin/events/${e.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {e.title}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(e.startsAt)}
                  </TableCell>
                  <TableCell>{e.city ?? "—"}</TableCell>
                  <TableCell>
                    {(e.categories?.length ? e.categories : e.category ? [{ slug: e.category, name: e.category }] : [])
                      .slice(0, 2)
                      .map((c) => c.name)
                      .join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/admin/events/${e.id}`} />}
                      >
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
