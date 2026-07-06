"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, RefreshCw, Globe, Mail, FileText, Trash2 } from "lucide-react"
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const allSelected = sources.length > 0 && sources.every((s) => selected.has(s.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setConfirming(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sources.map((s) => s.id)))
    setConfirming(false)
  }

  async function bulkDelete() {
    setBulkBusy(true)
    const results = await Promise.all(
      [...selected].map((id) => authedFetch(`/api/admin/event-sources/${id}`, { method: "DELETE" }))
    )
    setBulkBusy(false)
    const failed = results.filter((r) => !r.ok).length
    if (failed === 0) toast.success(`Obrisano ${results.length} izvora`)
    else toast.warning(`${results.length - failed} obrisano, ${failed} nije uspjelo`)
    setSelected(new Set())
    setConfirming(false)
    onDelete?.()
  }

  async function reparse(id: string, label: string) {
    const res = await authedFetch(`/api/admin/event-sources/${id}/reparse`, { method: "POST" })
    if (res.ok) { toast.success("Reparsiranje završeno", { description: label }); onReparse?.() }
    else toast.error("Reparsiranje neuspješno")
  }

  async function deleteSource(id: string, label: string) {
    const res = await authedFetch(`/api/admin/event-sources/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success(`Obrisano: ${label}`)
      setSelected((p) => { const n = new Set(p); n.delete(id); return n })
      onDelete?.()
    } else {
      toast.error("Greška pri brisanju")
    }
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
    <div className="flex flex-col gap-2">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} odabrano</span>
          {confirming ? (
            <>
              <span className="text-destructive">Sigurno obrisati {selected.size} izvora?</span>
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
              Obriši odabrano
            </Button>
          )}
          <button onClick={() => { setSelected(new Set()); setConfirming(false) }} className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground">
            Odustani
          </button>
        </div>
      )}
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
              <TableHead>Izvor</TableHead>
              <TableHead>Organizator</TableHead>
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
                <TableRow key={s.id} className={selected.has(s.id) ? "bg-muted/30" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="size-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">{typeIcon[s.type] ?? <FileText className="size-3.5 shrink-0 text-muted-foreground" />}</span>
                      <div className="min-w-0">
                        <Link href={`/admin/sources/${s.id}`} className="block truncate font-medium text-foreground hover:underline">
                          {primary}
                        </Link>
                        {secondary && secondary !== primary && (
                          <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.organizerName ? (
                      <div>
                        <span className="font-medium">{s.organizerName}</span>
                        {s.organizerEmail && <span className="block text-xs text-muted-foreground">{s.organizerEmail}</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-right">
                    {s.confidence > 0 ? <ConfidenceBadge value={s.confidence} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.candidateCount}</TableCell>
                  <TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground">
                    {formatRelative(s.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/sources/${s.id}`} />}>
                        <Eye data-icon="inline-start" />
                        Pregled
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Ponovno parsiraj" onClick={() => reparse(s.id, primary)}>
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
    </div>
  )
}
