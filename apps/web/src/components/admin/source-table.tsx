"use client"

import Link from "next/link"
import { Eye, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { EmptyState, DeleteButton } from "@/components/admin/states"
import { formatRelative } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import type { EventSource } from "@/lib/admin/types"

const typeLabels: Record<string, string> = {
  url: "URL",
  manual: "Ručno",
  portal: "Portal",
  organizer: "Organizator",
  "tourist-board": "Turistička zajednica",
}

export function SourceTable({
  sources,
  onReparse,
  onDelete,
}: {
  sources: EventSource[]
  onReparse?: () => void
  onDelete?: () => void
}) {
  async function reparse(id: string, subject: string) {
    const res = await authedFetch(`/api/admin/event-sources/${id}/reparse`, { method: "POST" })
    if (res.ok) { toast.success("Reparsiranje završeno", { description: subject }); onReparse?.() }
    else toast.error("Reparsiranje neuspješno")
  }

  async function deleteSource(id: string, subject: string) {
    const res = await authedFetch(`/api/admin/event-sources/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success(`Obrisano: ${subject}`); onDelete?.() }
    else toast.error("Greška pri brisanju")
  }

  if (sources.length === 0) {
    return (
      <EmptyState
        title="Još nema izvora"
        description="Zalijepite URL ili dodajte ručni izvor da biste započeli prikupljanje događaja."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Izvor</TableHead>
            <TableHead>Tip</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Pouzdanost</TableHead>
            <TableHead className="text-right">Kandidati</TableHead>
            <TableHead className="text-right whitespace-nowrap">Dodano</TableHead>
            <TableHead className="text-right">Akcije</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="max-w-[280px]">
                <Link
                  href={`/admin/sources/${s.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {s.subject}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  {s.sourceUrl}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="rounded-md font-normal">
                  {typeLabels[s.type] ?? s.type}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={s.status} />
              </TableCell>
              <TableCell className="text-right">
                {s.confidence > 0 ? (
                  <ConfidenceBadge value={s.confidence} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {s.candidateCount}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                {formatRelative(s.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/admin/sources/${s.id}`} />}
                  >
                    <Eye data-icon="inline-start" />
                    Pregled
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Ponovno parsiraj"
                    onClick={() => reparse(s.id, s.subject)}
                  >
                    <RefreshCw />
                  </Button>
                  <DeleteButton onDelete={() => deleteSource(s.id, s.subject)} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
