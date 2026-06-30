"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { EmptyState } from "@/components/admin/states"
import { formatDateTime } from "@/lib/admin/format"
import type { AdminEvent, EventStatus } from "@/lib/admin/types"

const statusOptions: { value: EventStatus | "all"; label: string }[] = [
  { value: "all", label: "Svi statusi" },
  { value: "pending", label: "Na čekanju" },
  { value: "approved", label: "Odobreno" },
  { value: "published", label: "Objavljeno" },
  { value: "rejected", label: "Odbijeno" },
  { value: "archived", label: "Arhivirano" },
  { value: "draft", label: "Skica" },
]

export function EventsTable({ events }: { events: AdminEvent[] }) {
  const [status, setStatus] = useState<string>("all")

  const filtered = useMemo(
    () => (status === "all" ? events : events.filter((e) => e.status === status)),
    [events, status]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtriraj:</span>
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
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Naziv</TableHead>
                <TableHead>Početak</TableHead>
                <TableHead>Grad</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead>Organizator</TableHead>
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
                  <TableCell>{e.category ?? "—"}</TableCell>
                  <TableCell>{e.organizer ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/admin/events/${e.id}`} />}
                    >
                      <Pencil data-icon="inline-start" />
                      Uredi
                    </Button>
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
