"use client"

import Link from "next/link"
import { Eye, Check, X, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/admin/status-badge"
import { ConfidenceBadge } from "@/components/admin/confidence-badge"
import { EmptyState } from "@/components/admin/states"
import { formatDateTime } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import type { AdminEvent } from "@/lib/admin/types"

export function PendingEventsTable({
  events,
  onAction,
}: {
  events: AdminEvent[]
  onAction?: () => void
}) {
  async function approve(id: string, title: string) {
    const res = await authedFetch(`/api/admin/events/${id}/approve`, {
      method: "POST",
    })
    if (res.ok) {
      toast.success(`Odobreno: ${title}`)
      onAction?.()
    } else {
      toast.error("Greška pri odobravanju")
    }
  }

  async function reject(id: string, title: string) {
    const res = await authedFetch(`/api/admin/events/${id}/reject`, {
      method: "POST",
    })
    if (res.ok) {
      toast.success(`Odbijeno: ${title}`)
      onAction?.()
    } else {
      toast.error("Greška pri odbijanju")
    }
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="Nema događaja na čekanju"
        description="Svi prikupljeni događaji su pregledani. Dobar posao!"
        icon={<Check />}
      />
    )
  }

  return (
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
            <TableHead className="text-right">Pouzdanost</TableHead>
            <TableHead className="text-center">Upozorenja</TableHead>
            <TableHead className="text-right">Akcije</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="max-w-[240px]">
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
                <ConfidenceBadge value={e.confidence} />
              </TableCell>
              <TableCell className="text-center">
                {e.warnings.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-sm text-warning">
                    <TriangleAlert className="size-3.5" />
                    {e.warnings.length}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/admin/events/${e.id}`} />}
                  >
                    <Eye data-icon="inline-start" />
                    Pregled
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Odobri"
                    className="text-success"
                    onClick={() => approve(e.id, e.title)}
                  >
                    <Check />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Odbij"
                    className="text-destructive"
                    onClick={() => reject(e.id, e.title)}
                  >
                    <X />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
