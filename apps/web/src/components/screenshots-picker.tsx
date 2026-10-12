"use client"

import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { ImagePlus, Loader2, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ScreenshotInput = {
  id: string
  name: string
  base64: string
  mediaType: string
  previewUrl: string
  /** Stored copy (Cloudinary) when the upload succeeded; otherwise the bytes are sent with the request. */
  imageUrl?: string
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_INPUT_BYTES = 15 * 1024 * 1024

/** Downscales to 1600 px so several posters fit one request; PNG stays PNG (sharp text), others become JPEG. */
export async function resizeToBase64(file: File, maxWidth = 1600): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Preglednik ne može obraditi sliku.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const mediaType = file.type === "image/png" ? "image/png" : "image/jpeg"
  const dataUrl = canvas.toDataURL(mediaType, 0.88)
  return { base64: dataUrl.split(",")[1] ?? "", mediaType }
}

/**
 * Selects one or more posters/screenshots as parsing input (EVT-07/08): file
 * picker, drag & drop and paste, with previews and per-image removal. These
 * are evidence for extraction, not public event images.
 */
export function ScreenshotsPicker({
  value,
  onChange,
  max = 4,
  upload,
  disabled,
  label = "Screenshotovi ili plakati",
  hint = "Do 4 slike (JPEG, PNG, WebP ili GIF). Slike služe kao izvor podataka za pregled, ne kao javna slika događaja.",
}: {
  value: ScreenshotInput[]
  onChange: (next: ScreenshotInput[]) => void
  max?: number
  upload?: (file: File) => Promise<string | undefined>
  disabled?: boolean
  label?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const labelId = useId()
  const errorId = useId()

  useEffect(() => () => { valueRef.current.forEach((shot) => URL.revokeObjectURL(shot.previewUrl)) }, [])

  async function add(files: File[]) {
    setError(null)
    const room = max - valueRef.current.length
    if (room <= 0) { setError(`Najviše ${max} slike.`); return }
    const accepted = files.filter((file) => ACCEPTED.includes(file.type))
    if (accepted.length < files.length) setError("Podržane su slike JPEG, PNG, WebP i GIF.")
    const tooBig = accepted.filter((file) => file.size > MAX_INPUT_BYTES)
    if (tooBig.length) setError("Slika je prevelika (najviše 15 MB prije smanjivanja).")
    const usable = accepted.filter((file) => file.size <= MAX_INPUT_BYTES)
    if (usable.length > room) setError(`Najviše ${max} slike — dodane su prve ${room}.`)
    for (const file of usable.slice(0, room)) {
      setBusy((n) => n + 1)
      try {
        const [{ base64, mediaType }, imageUrl] = await Promise.all([resizeToBase64(file), upload ? upload(file).catch(() => undefined) : Promise.resolve(undefined)])
        if (valueRef.current.some((shot) => shot.base64 === base64)) { setError("Ista slika je već dodana."); continue }
        const shot = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name || "zalijepljena slika", base64, mediaType, previewUrl: URL.createObjectURL(file), imageUrl }
        onChange([...valueRef.current, shot])
        valueRef.current = [...valueRef.current, shot]
      } catch {
        setError("Sliku nije bilo moguće učitati.")
      } finally {
        setBusy((n) => n - 1)
      }
    }
  }

  function remove(id: string) {
    const shot = value.find((item) => item.id === id)
    if (shot) URL.revokeObjectURL(shot.previewUrl)
    onChange(value.filter((item) => item.id !== id))
    setError(null)
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"))
    if (images.length) { event.preventDefault(); void add(images) }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) void add(Array.from(event.dataTransfer.files))
  }

  const full = value.length >= max
  return (
    <div className="flex flex-col gap-2" onPaste={onPaste}>
      <span id={labelId} className="text-sm font-medium">{label}</span>
      {value.length > 0 && (
        <ul aria-labelledby={labelId} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {value.map((shot, index) => (
            <li key={shot.id} className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={shot.previewUrl} alt={`Slika ${index + 1}: ${shot.name}`} className="aspect-[3/4] w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-2 py-1 text-[11px]">
                {shot.imageUrl ? "Spremljeno" : "Samo za obradu"}
              </span>
              <button type="button" onClick={() => remove(shot.id)} disabled={disabled} aria-label={`Ukloni sliku ${index + 1}`}
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background">
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-describedby={error ? errorId : undefined}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click() } }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/50",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} multiple className="hidden" disabled={disabled}
            onChange={(event) => { void add(Array.from(event.target.files ?? [])); event.currentTarget.value = "" }} />
          {busy > 0 ? <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden /> : value.length ? <ImagePlus className="size-6 text-muted-foreground" aria-hidden /> : <Upload className="size-6 text-muted-foreground" aria-hidden />}
          <span className="text-sm font-medium">{busy > 0 ? "Učitavanje slike…" : value.length ? "Dodaj još jednu sliku" : "Učitajte, povucite ili zalijepite sliku"}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">{value.length} / {max} slika</p>
      {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

/** Request payload for the API (EVT-07/08). */
export function screenshotsPayload(shots: ScreenshotInput[]) {
  return shots.map(({ base64, mediaType, imageUrl }) => ({ base64, mediaType, ...(imageUrl ? { imageUrl } : {}) }))
}
