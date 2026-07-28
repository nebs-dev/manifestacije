"use client"

import { useState } from "react"
import Link from "next/link"
import { Globe, FileText, Play, Loader2, Pause, PlayCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/admin/status-badge"
import { EmptyState, DeleteButton } from "@/components/admin/states"
import { formatRelative } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import type { MonitoredSource } from "@/lib/admin/types"

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") }
  catch { return url }
}

function formatNextCheck(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  if (date.getTime() <= Date.now()) return "uskoro"
  return date.toLocaleString("hr-HR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function MonitoredSourceTable({ sources, onChange }: { sources: MonitoredSource[]; onChange?: () => void }) {
  const [runningId, setRunningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function runNow(id: string, name: string) {
    if (runningId) return
    setRunningId(id)
    try {
      const res = await authedFetch(`/api/admin/monitored-sources/${id}/run`, { method: "POST" })
      if (res.ok) { toast.success("Provjera završena", { description: name }); onChange?.() }
      else toast.error("Provjera neuspješna", { description: await res.text() })
    } finally {
      setRunningId(null)
    }
  }

  async function toggleActive(source: MonitoredSource) {
    if (togglingId) return
    setTogglingId(source.id)
    try {
      const res = await authedFetch(`/api/admin/monitored-sources/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !source.isActive }),
      })
      if (res.ok) { onChange?.() }
      else toast.error("Promjena statusa neuspješna")
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteSource(id: string, name: string) {
    const res = await authedFetch(`/api/admin/monitored-sources/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success(`Obrisano: ${name}`); onChange?.() }
    else toast.error("Greška pri brisanju")
  }

  if (sources.length === 0) {
    return (
      <EmptyState
        title="Još nema nadziranih izvora"
        description="Dodajte URL turističke zajednice, organizatora ili portala da se periodički provjerava."
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
            <TableHead className="text-right">Neuspjelih zaredom</TableHead>
            <TableHead className="text-right whitespace-nowrap">Zadnja provjera</TableHead>
            <TableHead className="text-right whitespace-nowrap">Sljedeća provjera</TableHead>
            <TableHead className="text-right">Akcije</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((s) => (
            <TableRow key={s.id} className={!s.isActive ? "opacity-60" : undefined}>
              <TableCell className="max-w-[280px]">
                <div className="flex items-start gap-2">
                  {s.sourceType === "LISTING_PAGE" ? (
                    <Globe className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <Link href={`/admin/monitored-sources/${s.id}`} className="block truncate font-medium text-foreground hover:underline">
                      {s.name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">{hostname(s.url)}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {s.sourceType === "LISTING_PAGE" ? "Listing" : "Pojedinačni event"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {!s.isActive ? <StatusBadge status="archived" /> : s.lastStatus ? <StatusBadge status={s.lastStatus} /> : <span className="text-xs text-muted-foreground">Još nije provjereno</span>}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {s.consecutiveFailures > 0 ? <span className="text-destructive">{s.consecutiveFailures}</span> : 0}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground">
                {s.lastCheckedAt ? formatRelative(s.lastCheckedAt) : "—"}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-sm text-muted-foreground">
                {s.isActive ? formatNextCheck(s.nextCheckAt) : "pauzirano"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={runningId === s.id ? "Provjera u tijeku" : "Provjeri sada"}
                    onClick={() => runNow(s.id, s.name)}
                    disabled={runningId !== null}
                  >
                    {runningId === s.id ? <Loader2 className="animate-spin" /> : <Play />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={s.isActive ? "Pauziraj" : "Nastavi"}
                    onClick={() => toggleActive(s)}
                    disabled={togglingId !== null}
                  >
                    {togglingId === s.id ? <Loader2 className="animate-spin" /> : s.isActive ? <Pause /> : <PlayCircle />}
                  </Button>
                  <DeleteButton onDelete={() => deleteSource(s.id, s.name)} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
