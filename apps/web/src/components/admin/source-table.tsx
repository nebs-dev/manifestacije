"use client"

import Link from "next/link"
import { Eye, RefreshCw, Globe, Mail, FileText } from "lucide-react"
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
import { EmptyState, DeleteButton } from "@/components/admin/states"
import { formatRelative } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import type { EventSource } from "@/lib/admin/types"

function sourceDisplayName(s: EventSource): { primary: string; secondary: string } {
  const isGeneric = /^Source #\d+$/i.test(s.subject ?? "")

  if (!isGeneric && s.subject) {
    const secondary = s.sourceUrl ? hostname(s.sourceUrl) : ""
    return { primary: s.subject, secondary }
  }

  if (s.sourceUrl) {
    return { primary: hostname(s.sourceUrl), secondary: s.sourceUrl }
  }

  if (s.from) {
    return { primary: s.from, secondary: "Ručni unos" }
  }

  return { primary: "Ručni unos", secondary: "" }
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") }
  catch { return url }
}

const typeIcon: Record<string, React.ReactNode> = {
  url: <Globe className="size-3.5 shrink-0 text-muted-foreground" />,
  manual: <FileText className="size-3.5 shrink-0 text-muted-foreground" />,
  portal: <Globe className="size-3.5 shrink-0 text-muted-foreground" />,
  organizer: <Mail className="size-3.5 shrink-0 text-muted-foreground" />,
  "tourist-board": <Globe className="size-3.5 shrink-0 text-muted-foreground" />,
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
  async function reparse(id: string, label: string) {
    const res = await authedFetch(`/api/admin/event-sources/${id}/reparse`, { method: "POST" })
    if (res.ok) { toast.success("Reparsiranje završeno", { description: label }); onReparse?.() }
    else toast.error("Reparsiranje neuspješno")
  }

  async function deleteSource(id: string, label: string) {
    const res = await authedFetch(`/api/admin/event-sources/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success(`Obrisano: ${label}`); onDelete?.() }
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
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Pouzdanost</TableHead>
            <TableHead className="text-right">Kandidati</TableHead>
            <TableHead className="text-right whitespace-nowrap">Dodano</TableHead>
            <TableHead className="text-right">Akcije</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((s) => {
            const { primary, secondary } = sourceDisplayName(s)
            return (
              <TableRow key={s.id}>
                <TableCell className="max-w-[320px]">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{typeIcon[s.type] ?? <FileText className="size-3.5 shrink-0 text-muted-foreground" />}</span>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/sources/${s.id}`}
                        className="block truncate font-medium text-foreground hover:underline"
                      >
                        {primary}
                      </Link>
                      {secondary && secondary !== primary && (
                        <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
                      )}
                    </div>
                  </div>
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
                <TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground">
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
                      onClick={() => reparse(s.id, primary)}
                    >
                      <RefreshCw />
                    </Button>
                    <DeleteButton onDelete={() => deleteSource(s.id, primary)} />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
