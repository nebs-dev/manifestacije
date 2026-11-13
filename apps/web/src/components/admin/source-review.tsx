"use client"

import { Textarea } from "@/components/ui/textarea"
import { ScreenshotsPicker, screenshotsPayload, type ScreenshotInput } from "@/components/screenshots-picker"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, RefreshCw, ExternalLink, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

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
import { StatusBadge } from "@/components/admin/status-badge"
import { ConfidenceBadge } from "@/components/admin/confidence-badge"
import { ParsedCandidateCard } from "@/components/admin/parsed-candidate-card"
import { CandidateRail, type RailFilter } from "@/components/admin/candidate-rail"
import { SourceEvidence } from "@/components/admin/source-evidence"
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

/**
 * The review screen, rearranged around the work instead of around the source.
 *
 * Measured on the screen this replaces, clearing six candidates took 14 clicks
 * and 20 256 px of scrolling, and the first candidate sat 1 697 px below the
 * top of a 900 px window — under a source summary, an image card, a textarea
 * with a four-image dropzone, and a collapsed raw-text panel. Six of those
 * clicks only opened a candidate so its fields existed.
 *
 * So: the candidates come first, one is open at a time across the full width,
 * the list of the others is a narrow rail beside it, and what the source
 * actually said sits in a third column next to the fields rather than two
 * screens above them. The tools used once a day — supplement, re-parse,
 * editing the source URL — moved below the fold where they belong.
 */
export function SourceReview({
  source,
  candidates,
  onReparse,
}: {
  source: EventSource
  candidates: ParsedCandidate[]
  onReparse?: () => void
}) {
  const [filter, setFilter] = useState<RailFilter>("pending")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const pending = useMemo(() => candidates.filter((c) => c._status === "pending" || !c._status), [candidates])
  const created = useMemo(() => candidates.filter((c) => c._status === "created"), [candidates])
  const ignored = useMemo(() => candidates.filter((c) => c._status === "ignored"), [candidates])
  const counts = { pending: pending.length, created: created.length, ignored: ignored.length, all: candidates.length }

  const listed = useMemo(() => {
    if (filter === "pending") return pending
    if (filter === "created") return created
    if (filter === "ignored") return ignored
    return candidates
  }, [filter, pending, created, ignored, candidates])

  // The active candidate follows the work: when the open one is decided it
  // leaves the pending list, and the next one takes its place without the
  // editor going back to a list to pick it.
  const active = listed.find((c) => c.id === activeId) ?? listed[0] ?? null
  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])

  /** Refuses to drop edits silently; the editor decides. */
  const leaveActive = useCallback(() => {
    if (!dirty) return true
    const ok = window.confirm("Ovaj kandidat ima nespremljene izmjene. Napustiti ga i izgubiti ih?")
    if (ok) setDirty(false)
    return ok
  }, [dirty])

  // The same protection for closing the tab or following a link out, which no
  // in-app handler can intercept.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  return (
    <div className="flex flex-col gap-4">
      <SourceStrip source={source} counts={counts} onReparse={onReparse} />

      {/* The evidence column stays even when nothing parsed: a source that
          yielded no candidates is precisely when an editor needs to see what
          it actually contained. */}
      <section
        className={[
          "grid items-start gap-4",
          candidates.length === 0
            ? "xl:grid-cols-[minmax(0,1fr)_minmax(260px,330px)]"
            : "xl:grid-cols-[minmax(200px,230px)_minmax(0,1fr)_minmax(260px,330px)]",
        ].join(" ")}
      >
        <h2 className="sr-only">Kandidati</h2>
        {candidates.length > 0 && (
          <CandidateRail
            candidates={listed}
            activeId={active?.id ?? null}
            onSelect={(candidate) => { if (leaveActive()) setActiveId(candidate.id) }}
            filter={filter}
            onFilterChange={(next) => { if (leaveActive()) { setFilter(next); setActiveId(null) } }}
            counts={counts}
            sourceId={source.id}
            onBulkDone={() => { setDirty(false); onReparse?.() }}
          />
        )}

        <div className="min-w-0">
          {candidates.length === 0 ? (
            <EmptyState title="Nema kandidata" description="Ovaj izvor nije dao nijednog kandidata." />
          ) : active ? (
            <ParsedCandidateCard
              key={active.id}
              candidate={active}
              alwaysOpen
              onUpdate={onReparse}
              onProcessed={() => { setDirty(false); setActiveId(null) }}
              onDirtyChange={setDirty}
            />
          ) : (
            <EmptyState
              title="Sve je obrađeno"
              description="Nijedan kandidat u ovom filtru ne čeka odluku."
            />
          )}
        </div>

        <SourceEvidence source={source} highlight={active?.title} />
      </section>

      <SourceTools source={source} onReparse={onReparse} />
    </div>
  )
}

/** One line of source context, in place of three stacked cards. */
function SourceStrip({
  source,
  counts,
  onReparse,
}: {
  source: EventSource
  counts: { pending: number; created: number; ignored: number; all: number }
  onReparse?: () => void
}) {
  const [reparsing, setReparsing] = useState(false)

  async function handleReparse() {
    if (reparsing) return
    setReparsing(true)
    try {
      const res = await authedFetch(`/api/admin/event-sources/${source.id}/reparse`, { method: "POST" })
      if (res.ok) toast.success("Ponovno parsiranje završeno", { description: "Promjene za otvorene kandidate prikazane su kao prijedlozi." })
      else toast.error("Ponovno parsiranje nije uspjelo", { description: await apiMessage(res) })
      onReparse?.()
    } finally {
      setReparsing(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-2.5">
      <span className="text-sm font-medium">{typeLabels[source.type] ?? source.type}</span>
      <StatusBadge status={source.status} />
      {source.confidence > 0 && <ConfidenceBadge value={source.confidence} />}
      <span className="text-sm text-muted-foreground" data-testid="candidate-counts">
        {counts.pending > 0 ? <span className="font-semibold text-warning">{counts.pending} čeka</span> : <span>sve obrađeno</span>}
        {counts.created > 0 && <span className="text-success"> · {counts.created} kreirano</span>}
        {counts.ignored > 0 && <span> · {counts.ignored} ignorirano</span>}
        <span> · {counts.all} ukupno</span>
      </span>
      {source.from && <span className="truncate text-sm text-muted-foreground">{source.from}</span>}
      <span className="text-sm text-muted-foreground">{formatDateTime(source.createdAt)}</span>
      <Button variant="outline" size="sm" className="ml-auto" onClick={handleReparse} disabled={reparsing}>
        {reparsing ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
        {reparsing ? "Reparsiranje…" : "Ponovno parsiraj"}
      </Button>
    </div>
  )
}

/** Everything that is not the daily work: below the candidates, folded away. */
function SourceTools({ source, onReparse }: { source: EventSource; onReparse?: () => void }) {
  const [sourceUrl, setSourceUrl] = useState(source.sourceUrl || "")
  const [savingUrl, setSavingUrl] = useState(false)

  useEffect(() => { setSourceUrl(source.sourceUrl || "") }, [source.sourceUrl])

  // This href is built from what an admin typed into the input beside it.
  // `safeExternalUrl` already rejects anything that is not http(s), but it
  // hands back the original string, so the guarantee is invisible at the point
  // of use — to a reader and to CodeQL alike. Re-parsing here and emitting the
  // parsed URL makes the scheme check the thing that actually produces the
  // value, rather than something that happened to it earlier.
  const externalHref = ((): string | undefined => {
    const sanitized = safeExternalUrl(sourceUrl)
    if (!sanitized) return undefined
    try {
      const parsed = new URL(sanitized)
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined
    } catch {
      return undefined
    }
  })()

  async function saveSourceUrl() {
    setSavingUrl(true)
    try {
      const res = await authedFetch(`/api/admin/event-sources/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({ sourceUrl: sourceUrl.trim() || null }),
      })
      if (res.ok) { toast.success("URL izvora spremljen"); onReparse?.() }
      else toast.error("Spremanje URL-a neuspješno", { description: await apiMessage(res) })
    } finally {
      setSavingUrl(false)
    }
  }

  return (
    <Card>
      <Collapsible defaultOpen={false}>
        <CardHeader>
          <CollapsibleTrigger render={<button type="button" className="group/tools flex w-full items-center justify-between gap-2 text-left" />}>
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-base">Alati izvora</CardTitle>
              <CardDescription>URL izvora, dopuna podataka i ponovno parsiranje.</CardDescription>
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/tools:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-4">
            <Separator />
            {source.parseError && (
              <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                {source.parseError}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`source-url-${source.id}`} className="text-xs text-muted-foreground">URL izvora</label>
              <div className="flex gap-2">
                <Input id={`source-url-${source.id}`} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
                {externalHref && (
                  <Button variant="outline" size="icon" nativeButton={false} render={<a href={externalHref} target="_blank" rel="noreferrer" aria-label="Otvori URL izvora" />}>
                    <ExternalLink className="size-4" />
                  </Button>
                )}
                <Button variant="outline" onClick={saveSourceUrl} disabled={savingUrl || sourceUrl === (source.sourceUrl || "")}>
                  <Save data-icon="inline-start" />
                  Spremi
                </Button>
              </div>
            </div>
            <SourceSupplementPanel source={source} onDone={onReparse} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
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
