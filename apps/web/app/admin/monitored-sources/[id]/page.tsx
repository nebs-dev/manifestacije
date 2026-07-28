"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ExternalLink, Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/admin/status-badge"
import { TableLoadingState, ErrorState, EmptyState } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { authedFetch } from "@/lib/admin/api"
import { adaptMonitoredSource, adaptMonitoredSourceRun } from "@/lib/admin/adapters"
import type { MonitoredSource, MonitoredSourceRun, MonitoredSourceType } from "@/lib/admin/types"

function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("hr-HR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function runSummary(run: MonitoredSourceRun): string {
  if (run.status === "FAILED") return run.error ?? "Nepoznata greška"
  if (!run.result) return "—"
  if (run.result.outcome === "not-modified" || run.result.outcome === "unchanged") return "Bez promjena (304 / isti sadržaj)"
  if (run.result.outcome === "changed") {
    return `${run.result.itemsFound ?? 0} stavki, ${run.result.itemsNew ?? 0} novih, ${run.result.candidatesCreated ?? 0} kandidata kreirano`
  }
  return "—"
}

function EditSourceForm({ source, onSaved, onCancel }: { source: MonitoredSource; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(source.name)
  const [url, setUrl] = useState(source.url)
  const [sourceType, setSourceType] = useState<MonitoredSourceType>(source.sourceType)
  const [checkIntervalDays, setCheckIntervalDays] = useState(String(Math.round(source.checkIntervalMinutes / 1440) || 1))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || !url.trim()) { toast.error("Naziv i URL su obavezni."); return }
    setSaving(true)
    try {
      const res = await authedFetch(`/api/admin/monitored-sources/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          url,
          sourceType,
          checkIntervalMinutes: (Number(checkIntervalDays) || 1) * 1440,
        }),
      })
      if (!res.ok) { toast.error("Spremanje neuspješno", { description: await res.text() }); return }
      toast.success("Izvor spremljen")
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="edit-ms-name">Naziv</FieldLabel>
        <Input id="edit-ms-name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      </Field>
      <Field>
        <FieldLabel htmlFor="edit-ms-url">URL</FieldLabel>
        <Input id="edit-ms-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={saving} />
      </Field>
      <Field>
        <FieldLabel>Tip izvora</FieldLabel>
        <Select value={sourceType} onValueChange={(v) => setSourceType(v as MonitoredSourceType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="LISTING_PAGE">Listing stranica (više događaja)</SelectItem>
              <SelectItem value="EVENT_PAGE">Stranica jednog događaja</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="edit-ms-interval">Provjera svakih (dana)</FieldLabel>
        <Input id="edit-ms-interval" type="number" min={1} step={1} value={checkIntervalDays} onChange={(e) => setCheckIntervalDays(e.target.value)} disabled={saving} />
      </Field>
      <Field orientation="horizontal" className="justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Odustani</Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
          {saving ? "Spremanje…" : "Spremi"}
        </Button>
      </Field>
    </FieldGroup>
  )
}

export default function MonitoredSourceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [source, setSource] = useState<MonitoredSource | null>(null)
  const [runs, setRuns] = useState<MonitoredSourceRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sourceRes, runsRes] = await Promise.all([
        authedFetch(`/api/admin/monitored-sources/${id}`),
        authedFetch(`/api/admin/monitored-sources/${id}/runs`),
      ])
      if (!sourceRes.ok) { setError("Izvor nije pronađen."); return }
      setSource(adaptMonitoredSource(await sourceRes.json()))
      setRuns(runsRes.ok ? ((await runsRes.json()) as Record<string, unknown>[]).map(adaptMonitoredSourceRun) : [])
    } catch {
      setError("Greška pri dohvaćanju izvora.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <TableLoadingState />
  if (error || !source) return <ErrorState description={error} onRetry={load} />

  return (
    <>
      <PageHeader
        title={source.name}
        description={source.url}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Nadzirani izvori", href: "/admin/monitored-sources" },
          { label: source.name },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editing ? "Uredi izvor" : "Status"}</CardTitle>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" /> Uredi
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <EditSourceForm source={source} onSaved={() => { setEditing(false); load() }} onCancel={() => setEditing(false)} />
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trenutni status</span>
                  {!source.isActive ? <StatusBadge status="archived" /> : source.lastStatus ? <StatusBadge status={source.lastStatus} /> : <span className="text-muted-foreground">Još nije provjereno</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tip</span>
                  <span>{source.sourceType === "LISTING_PAGE" ? "Listing stranica" : "Pojedinačni event"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provjera svakih</span>
                  <span>{Math.round(source.checkIntervalMinutes / 1440) || 1} dan(a)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Zadnja provjera</span>
                  <span>{formatDateTime(source.lastCheckedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sljedeća provjera</span>
                  <span>{source.isActive ? formatDateTime(source.nextCheckAt) : "pauzirano"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Neuspjelih zaredom</span>
                  <span className={source.consecutiveFailures > 0 ? "text-destructive" : undefined}>{source.consecutiveFailures}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {source.lastError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader><CardTitle className="text-destructive">Zadnja greška</CardTitle></CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words text-sm text-destructive">{source.lastError}</pre>
            </CardContent>
          </Card>
        )}
      </div>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Povijest provjera</h2>
        {runs.length === 0 ? (
          <EmptyState title="Još nema provjera" description="Klikni 'Provjeri sada' na listi izvora." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Kada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rezultat</TableHead>
                  <TableHead className="text-right">Kandidati</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(run.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={run.status} /></TableCell>
                    <TableCell className="max-w-[480px] text-sm">
                      <span className={run.status === "FAILED" ? "text-destructive" : undefined}>{runSummary(run)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {run.result?.eventSourceId ? (
                        <Link href={`/admin/sources/${run.result.eventSourceId}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                          Pregled <ExternalLink className="size-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  )
}
