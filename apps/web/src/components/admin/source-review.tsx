"use client"

import { Textarea } from "@/components/ui/textarea"
import { ScreenshotsPicker, screenshotsPayload, type ScreenshotInput } from "@/components/screenshots-picker"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, RefreshCw, ExternalLink, Search, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
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
import { ParsedCandidateCard } from "@/components/admin/parsed-candidate-card"
import { EmptyState } from "@/components/admin/states"
import { formatDateTime } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import { safeExternalUrl } from "@/lib/safe-url"
import type { EventSource, ParsedCandidate } from "@/lib/admin/types"

const typeLabels: Record<string, string> = {
  url: "URL",
  manual: "Ručno",
  portal: "Portal",
  organizer: "Organizator",
  "tourist-board": "Turistička zajednica",
}

type Tab = "pending" | "created" | "ignored" | "all"

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function CreatedRow({ c, onUpdate }: { c: ParsedCandidate; onUpdate?: () => void }) {
  return (
    <TableRow className="opacity-60">
      <TableCell className="font-medium text-sm">
        {c._eventId ? (
          <Link href={`/admin/events/${c._eventId}`} className="hover:underline text-success">
            {c.title || "—"}
          </Link>
        ) : c.title || "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {c.startsAt ? new Date(c.startsAt).toLocaleDateString("hr") : "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{c.city || "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{c.category || "—"}</TableCell>
      <TableCell className="text-right">
        {c._eventId && (
          <Link href={`/admin/events/${c._eventId}`} className="text-xs text-success hover:underline">
            Event #{c._eventId} →
          </Link>
        )}
      </TableCell>
    </TableRow>
  )
}

function IgnoredRow({ c, onUpdate }: { c: ParsedCandidate; onUpdate?: () => void }) {
  async function unignore() {
    const res = await authedFetch(`/api/admin/event-sources/${c.sourceId}/ignore-candidate`, {
      method: "POST",
      body: JSON.stringify({ candidateIndex: c.candidateIndex, undo: true }),
    })
    if (res.ok) { toast.success("Vraćeno na čekanje"); onUpdate?.() }
    else {
      // Fallback — reparse refreshes status
      toast.info("Koristite 'Ponovno parsiraj' za vraćanje kandidata")
    }
  }

  return (
    <TableRow className="opacity-50">
      <TableCell className="text-sm line-through text-muted-foreground">{c.title || "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {c.startsAt ? new Date(c.startsAt).toLocaleDateString("hr") : "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{c.city || "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{c.category || "—"}</TableCell>
      <TableCell className="text-right">
        <ConfidenceBadge value={c.confidence} />
      </TableCell>
    </TableRow>
  )
}

export function SourceReview({
  source,
  candidates,
  onReparse,
}: {
  source: EventSource
  candidates: ParsedCandidate[]
  onReparse?: () => void
}) {
  const [tab, setTab] = useState<Tab>("pending")
  const [search, setSearch] = useState("")
  const [sourceUrl, setSourceUrl] = useState(source.sourceUrl || "")
  const images = source.sourceImageSrcs?.length ? source.sourceImageSrcs
    : [safeExternalUrl(source.sourceImageUrl) ?? source.pendingScreenshotSrc].filter((src): src is string => Boolean(src))
  const [savingUrl, setSavingUrl] = useState(false)
  const [reparsing, setReparsing] = useState(false)

  useEffect(() => {
    setSourceUrl(source.sourceUrl || "")
  }, [source.sourceUrl])

  const pending = useMemo(() => candidates.filter((c) => c._status === "pending" || (!c._status)), [candidates])
  const created = useMemo(() => candidates.filter((c) => c._status === "created"), [candidates])
  const ignored = useMemo(() => candidates.filter((c) => c._status === "ignored"), [candidates])

  const visible = useMemo(() => {
    const base = tab === "pending" ? pending : tab === "created" ? created : tab === "ignored" ? ignored : candidates
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter((c) =>
      c.title?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q)
    )
  }, [tab, search, pending, created, ignored, candidates])

  async function handleReparse() {
    if (reparsing) return
    setReparsing(true)
    try {
      const res = await authedFetch(`/api/admin/event-sources/${source.id}/reparse`, { method: "POST" })
      if (res.ok) { toast.success("Ponovno parsiranje završeno", { description: "Promjene za otvorene kandidate prikazane su kao prijedlozi." }); onReparse?.() }
      else { toast.error("Ponovno parsiranje nije uspjelo", { description: await apiMessage(res) }); onReparse?.() }
    } finally {
      setReparsing(false)
    }
  }

  async function saveSourceUrl() {
    setSavingUrl(true)
    try {
      const res = await authedFetch(`/api/admin/event-sources/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({ sourceUrl: sourceUrl.trim() || null }),
      })
      if (res.ok) { toast.success("URL izvora spremljen"); onReparse?.() }
      else toast.error("Spremanje URL-a neuspješno", { description: await res.text() })
    } finally {
      setSavingUrl(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Source summary */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{source.subject}</CardTitle>
              <CardDescription>Sažetak izvora i dokazi parsiranja.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleReparse} disabled={reparsing}>
              {reparsing ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {reparsing ? "Reparsiranje…" : "Ponovno parsiraj"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
            <span className="text-xs text-muted-foreground">URL izvora</span>
            <div className="flex gap-2">
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
              {safeExternalUrl(sourceUrl) && (
                <Button variant="outline" size="icon" nativeButton={false} render={<a href={safeExternalUrl(sourceUrl)} target="_blank" rel="noreferrer" aria-label="Otvori URL izvora" />}>
                  <ExternalLink className="size-4" />
                </Button>
              )}
              <Button variant="outline" onClick={saveSourceUrl} disabled={savingUrl || sourceUrl === (source.sourceUrl || "")}>
                <Save data-icon="inline-start" />
                Spremi
              </Button>
            </div>
          </div>
          <SummaryRow label="Tip" value={typeLabels[source.type] ?? source.type} />
          <SummaryRow label="Status" value={<StatusBadge status={source.status} />} />
          <SummaryRow label="Pouzdanost" value={source.confidence > 0 ? <ConfidenceBadge value={source.confidence} /> : "—"} />
          <SummaryRow label="Pošiljatelj" value={source.from || "—"} />
          <SummaryRow label="Kandidati" value={
            <span className="flex gap-3">
              <span>{candidates.length} ukupno</span>
              {created.length > 0 && <span className="text-success">{created.length} kreirana</span>}
              {pending.length > 0 && <span className="text-warning">{pending.length} čeka</span>}
              {ignored.length > 0 && <span className="text-muted-foreground">{ignored.length} ignorirano</span>}
            </span>
          } />
          <SummaryRow label="Kreirano" value={formatDateTime(source.createdAt)} />
        </CardContent>
      </Card>

      {source.parseError && (
        <Card role="status" className="border-warning/40 bg-warning/10">
          <CardHeader>
            <CardTitle className="font-heading text-base">Automatska obrada nije dovršena</CardTitle>
            <CardDescription>{source.parseError}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Source image evidence (EVT-07: several posters/screenshots) */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">{images.length > 1 ? `Slike izvora (${images.length})` : "Screenshot / plakat izvora"}</CardTitle>
            <CardDescription>Slike korištene kao dokaz za parsiranje. Ne koriste se automatski kao javna slika događaja.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((src, index) => (
                <li key={src.slice(0, 120) + index} className="flex flex-col gap-1">
                  <Image src={src} alt={`Slika izvora ${index + 1}`} width={1200} height={900} unoptimized className="h-auto max-h-[420px] w-full rounded-lg border border-border object-contain" />
                  {!src.startsWith("data:") && (
                    <a href={src} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Otvori sliku {index + 1}</a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SourceSupplementPanel source={source} onDone={onReparse} />

      {/* Raw text */}
      {source.rawText && (
        <Card>
          <Collapsible defaultOpen={false}>
            <CardHeader>
              <CollapsibleTrigger render={<button type="button" className="group/raw flex w-full items-center justify-between gap-2 text-left" />}>
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="text-base">Neobrađeni tekst izvora</CardTitle>
                  <CardDescription>Originalni tekst korišten za parsiranje.</CardDescription>
                </div>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/raw:rotate-180" />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <Separator className="mb-4" />
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                  {source.rawText}
                </pre>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Candidates */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Parsirani kandidati</h2>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
                Na čekanju{pending.length > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 py-0.5 text-xs text-warning">{pending.length}</span>}
              </TabButton>
              <TabButton active={tab === "created"} onClick={() => setTab("created")}>
                Kreirani{created.length > 0 && <span className="ml-1.5 rounded-full bg-success/20 px-1.5 py-0.5 text-xs text-success">{created.length}</span>}
              </TabButton>
              <TabButton active={tab === "ignored"} onClick={() => setTab("ignored")}>
                Ignorirani{ignored.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{ignored.length}</span>}
              </TabButton>
              <TabButton active={tab === "all"} onClick={() => setTab("all")}>
                Sve
              </TabButton>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pretraži…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 pl-8 h-8"
              />
            </div>

            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {visible.length} / {candidates.length}
            </span>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="Nema kandidata" description="Nema kandidata koji odgovaraju odabranom filtru." />
        ) : tab === "pending" || tab === "all" ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
            {visible.map((c) => (
              c._status === "created" ? (
                <div key={c.id} className="overflow-x-auto rounded-xl border border-border bg-card">
                  <Table><TableBody><CreatedRow c={c} onUpdate={onReparse} /></TableBody></Table>
                </div>
              ) : c._status === "ignored" ? (
                <div key={c.id} className="overflow-x-auto rounded-xl border border-border bg-card">
                  <Table><TableBody><IgnoredRow c={c} onUpdate={onReparse} /></TableBody></Table>
                </div>
              ) : (
                <ParsedCandidateCard key={c.id} candidate={c} onUpdate={onReparse} />
              )
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Naslov</TableHead>
                  <TableHead className="whitespace-nowrap">Datum</TableHead>
                  <TableHead>Grad</TableHead>
                  <TableHead>Kategorija</TableHead>
                  <TableHead className="text-right">
                    {tab === "created" ? "Event" : "Pouzdanost"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) =>
                  tab === "created"
                    ? <CreatedRow key={c.id} c={c} onUpdate={onReparse} />
                    : <IgnoredRow key={c.id} c={c} onUpdate={onReparse} />
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

async function apiMessage(res: Response): Promise<string | undefined> {
  const text = await res.text().catch(() => "")
  try { return (JSON.parse(text) as { message?: string }).message ?? text } catch { return text || undefined }
}

async function uploadAdminEvidence(file: File): Promise<string | undefined> {
  const form = new FormData()
  form.append("file", file)
  try {
    const res = await authedFetch("/api/admin/uploads/event-image", { method: "POST", body: form })
    return res.ok ? ((await res.json()) as { imageUrl?: string }).imageUrl : undefined
  } catch {
    return undefined
  }
}

/**
 * EVT-08: add missing information (text and/or more images) and re-parse.
 * Inputs are stored on the source first; open candidates receive proposals
 * instead of being overwritten, and nothing is published automatically.
 */
function SourceSupplementPanel({ source, onDone }: { source: EventSource; onDone?: () => void }) {
  const [text, setText] = useState("")
  const [shots, setShots] = useState<ScreenshotInput[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null)

  async function submit() {
    if (!text.trim() && !shots.length) { setNotice({ tone: "error", text: "Dodajte tekst ili barem jednu sliku." }); return }
    setBusy(true); setNotice(null)
    try {
      const res = await authedFetch(`/api/admin/event-sources/${source.id}/supplement`, {
        method: "POST",
        body: JSON.stringify({ text: text.trim() || undefined, screenshots: screenshotsPayload(shots), expectedUpdatedAt: source.updatedAt }),
      })
      if (res.ok) {
        setText(""); setShots([])
        setNotice({ tone: "ok", text: "Dopuna je obrađena. Provjerite prijedloge uz kandidate i primijenite one koje želite." })
        toast.success("Dopuna obrađena")
        onDone?.()
      } else if (res.status === 503) {
        // The supplement is already stored; sending the same form again retries it.
        setNotice({ tone: "warn", text: (await apiMessage(res)) ?? "Dopuna je spremljena, ali automatska obrada nije uspjela. Pokušajte ponovno." })
        onDone?.()
      } else {
        setNotice({ tone: "error", text: (await apiMessage(res)) ?? "Dopunu nije bilo moguće spremiti." })
      }
    } catch {
      setNotice({ tone: "error", text: "Greška pri spajanju na server." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Dopuni i ponovno parsiraj</CardTitle>
        <CardDescription>Nedostaje podatak? Dodajte tekst (npr. točno vrijeme, cijenu, lokaciju) ili još slika. Postojeći kandidati se ne mijenjaju — dobit ćete prijedloge koje sami potvrđujete.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(source.supplements?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Dosadašnje dopune</span>
            <ul className="flex flex-col gap-1 text-sm">
              {source.supplements!.map((item) => (
                <li key={item.id} className="rounded-md bg-muted/40 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{item.at ? formatDateTime(item.at) : "—"}{item.imageCount ? ` · ${item.imageCount} ${item.imageCount === 1 ? "slika" : "slike"}` : ""}</span>
                  {item.text && <p className="line-clamp-3 whitespace-pre-line">{item.text}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`supplement-${source.id}`} className="text-sm font-medium">Dodatne informacije</label>
          <Textarea id={`supplement-${source.id}`} rows={4} value={text} onChange={(event) => setText(event.target.value)} disabled={busy}
            placeholder="npr. Početak je u 20 h, ulaznice 10 EUR na blagajni, lokacija Dvorana Gradskog vrta." />
        </div>
        <ScreenshotsPicker value={shots} onChange={setShots} upload={uploadAdminEvidence} disabled={busy} label="Dodatne slike (neobavezno)" />
        {notice && (
          <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "ok" ? "text-sm text-success" : notice.tone === "warn" ? "text-sm text-warning" : "text-sm text-destructive"}>{notice.text}</p>
        )}
        <div>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? "Obrada…" : notice?.tone === "warn" ? "Pokušaj ponovno" : "Dopuni i ponovno parsiraj"}</Button>
        </div>
      </CardContent>
    </Card>
  )
}
