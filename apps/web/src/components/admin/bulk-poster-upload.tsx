"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, TriangleAlert, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authedFetch } from "@/lib/admin/api"
import { resizeToBase64 } from "@/components/screenshots-picker"
import { runQueue } from "@/lib/admin/run-queue"
import { cn } from "@/lib/utils"

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"]
/** Each poster is its own LLM call; two at a time keeps the provider happy. */
const CONCURRENCY = 2

type ItemStatus = "pending" | "running" | "done" | "error"

type Item = {
  id: string
  name: string
  file: File
  previewUrl: string
  status: ItemStatus
  sourceId?: number
  candidates?: number
  error?: string
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "Čeka",
  running: "Obrađuje se",
  done: "Obrađeno",
  error: "Greška",
}

/**
 * Bulk poster processing (BULK-01).
 *
 * Twenty posters are twenty separate events, so each one is parsed as its own
 * source — not as twenty images of one event, which is what the existing
 * upload does. The run is a queue with a couple of posters in flight: a
 * poster that fails is reported on its own line and can be retried, and
 * everything already parsed is saved as a source whatever happens next.
 *
 * No internet research happens here: the posters are read, nothing is looked
 * up, and nothing is published. Every parsed source lands in the review list
 * as it does today.
 */
export function BulkPosterUpload() {
  const [items, setItems] = useState<Item[]>([])
  const [running, setRunning] = useState(false)
  const stopRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const update = (id: string, patch: Partial<Item>) =>
    setItems(current => current.map(item => (item.id === id ? { ...item, ...patch } : item)))

  function addFiles(files: FileList | null) {
    if (!files?.length) return
    const accepted: Item[] = []
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: podržani su JPEG, PNG, WebP i GIF.`)
        continue
      }
      accepted.push({ id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, file, previewUrl: URL.createObjectURL(file), status: "pending" })
    }
    setItems(current => {
      const known = new Set(current.map(item => item.id))
      return [...current, ...accepted.filter(item => !known.has(item.id))]
    })
  }

  async function parseOne(item: Item) {
    update(item.id, { status: "running", error: undefined })
    const { base64, mediaType } = await resizeToBase64(item.file)
    const response = await authedFetch("/api/admin/event-sources/manual-email", {
      method: "POST",
      body: JSON.stringify({
        screenshots: [{ base64, mediaType }],
        // Every poster goes through the vision parser; that is the point of
        // the bulk run.
        useLlm: true,
      }),
    })
    if (!response.ok) throw new Error((await response.text()) || "Obrada nije uspjela.")
    const source = await response.json()
    update(item.id, { status: "done", sourceId: source.id, candidates: source.parsedJson?.candidates?.length ?? 0 })
  }

  async function processAll(only?: Item[]) {
    const queue = (only ?? items).filter(item => item.status !== "done")
    if (!queue.length) return
    stopRef.current = false
    setRunning(true)
    try {
      await runQueue(queue, parseOne, {
        concurrency: CONCURRENCY,
        shouldStop: () => stopRef.current,
        onSettled: (item, error) => {
          if (error) update(item.id, { status: "error", error: error instanceof Error ? error.message : String(error) })
        },
      })
    } finally {
      setRunning(false)
    }
  }

  const done = items.filter(item => item.status === "done").length
  const failed = items.filter(item => item.status === "error")
  const parsedCandidates = items.reduce((sum, item) => sum + (item.candidates ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id="bulk-posters"
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={event => { addFiles(event.target.files); event.target.value = "" }}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={running}>
          <Upload className="size-4" /> Odaberi plakate
        </Button>
        <Button type="button" onClick={() => processAll()} disabled={running || !items.some(item => item.status !== "done")}>
          {running && <Loader2 className="size-4 animate-spin" />} Obradi sve
        </Button>
        {running && (
          <Button type="button" variant="outline" onClick={() => { stopRef.current = true; toast.info("Zaustavljanje nakon trenutnih plakata.") }}>
            Zaustavi
          </Button>
        )}
        {failed.length > 0 && !running && (
          <Button type="button" variant="outline" onClick={() => processAll(failed)}>
            Pokušaj ponovno ({failed.length})
          </Button>
        )}
        {items.length > 0 && !running && (
          <Button type="button" variant="ghost" onClick={() => setItems([])}>Očisti popis</Button>
        )}
      </div>

      {items.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Obrađeno {done} od {items.length}
          {parsedCandidates > 0 && ` · prepoznato ${parsedCandidates} događaja`}
          {failed.length > 0 && ` · ${failed.length} s greškom`}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map(item => (
          <li key={item.id} className={cn("flex items-center gap-3 rounded-lg border border-border p-2",
            item.status === "error" && "border-destructive/50 bg-destructive/5")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never a remote asset */}
            <img src={item.previewUrl} alt="" className="size-12 rounded object-cover" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {STATUS_LABEL[item.status]}
                {item.status === "done" && item.candidates !== undefined && ` · ${item.candidates} prepoznatih događaja`}
                {item.error && ` · ${item.error}`}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {item.status === "running" && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Obrađuje se" />}
              {item.status === "done" && <CheckCircle2 className="size-4 text-primary" aria-label="Obrađeno" />}
              {item.status === "error" && <TriangleAlert className="size-4 text-destructive" aria-label="Greška" />}
              {item.sourceId && (
                <Link href={`/admin/sources/${item.sourceId}`} className="text-sm text-primary hover:underline">Pregledaj</Link>
              )}
              {!running && item.status !== "done" && (
                <button type="button" aria-label={`Ukloni ${item.name}`} className="cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => setItems(current => current.filter(other => other.id !== item.id))}>
                  <X className="size-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {done > 0 && !running && (
        <p className="text-sm">
          <Link href="/admin/sources" className="text-primary hover:underline">Otvori popis izvora za pregled →</Link>
        </p>
      )}
    </div>
  )
}
