"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { authedFetch } from "@/lib/admin/api"
import { eventImagePrimaryUrl } from "@/lib/event-image-variants"
import { cn } from "@/lib/utils"

export type EventImageValue = {
  imageUrl: string
}

export function EventImagePicker({
  value,
  onChange,
  disabled,
  suggestedImageUrl,
  hideUrlField,
  uploadPath = "/api/admin/uploads/event-image",
  uploadFetch = authedFetch,
  fit = "cover",
  aspectClassName,
  label = "Slika događaja",
}: {
  value: EventImageValue
  onChange: (value: EventImageValue) => void
  disabled?: boolean
  suggestedImageUrl?: string | null
  hideUrlField?: boolean
  uploadPath?: string
  uploadFetch?: typeof authedFetch
  fit?: "cover" | "contain"
  aspectClassName?: string
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    setImageDimensions(null)
    if (!value.imageUrl) return
    let active = true
    const image = new window.Image()
    image.onload = () => {
      if (active) setImageDimensions({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.src = value.imageUrl
    return () => {
      active = false
    }
  }, [value.imageUrl])

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const imageItem = Array.from(e.clipboardData?.items ?? []).find((item) => item.type.startsWith("image/"))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (!file) return
      e.preventDefault()
      void upload(file)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading])

  function patch(next: Partial<EventImageValue>) {
    onChange({ ...value, ...next })
  }

  async function upload(file: File) {
    const form = new FormData()
    form.append("file", file)
    setUploading(true)
    try {
      const res = await uploadFetch(uploadPath, {
        method: "POST",
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { imageUrl: string }
      patch({ imageUrl: data.imageUrl })
      toast.success("Slika učitana")
    } catch (err) {
      toast.error("Upload slike nije uspio", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const hasSuggested = Boolean(suggestedImageUrl) && suggestedImageUrl !== value.imageUrl
  const imageWarnings = imageDimensions && fit === "cover" ? [
    ...(imageDimensions.width < 1200
      ? [`Slika je ${imageDimensions.width}×${imageDimensions.height}px; preporučeno je najmanje 1200px širine.`]
      : []),
    ...(imageDimensions.height > imageDimensions.width
      ? ["Detail prikazuje cijelu portretnu sliku, ali će kartice koristiti 4:3 crop."]
      : []),
  ] : []
  const previewUrl = value.imageUrl && fit === "cover"
    ? eventImagePrimaryUrl(value.imageUrl, "detail")
    : value.imageUrl
  const isAdaptiveEventPreview = fit === "cover" && !aspectClassName

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <div className={cn(
          "overflow-hidden rounded-2xl border border-border bg-muted",
          isAdaptiveEventPreview && "flex items-center justify-center bg-ink",
        )}>
          {value.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Slika događaja"
              className={cn(
                "w-full",
                aspectClassName,
                isAdaptiveEventPreview
                  ? "block h-auto max-h-[640px] object-contain"
                  : fit === "contain" ? "object-contain" : "object-cover",
              )}
            />
          ) : (
            <div className={cn("flex items-center justify-center text-sm text-muted-foreground", aspectClassName ?? "min-h-48")}>
              Nema slike
            </div>
          )}
        </div>
        {imageWarnings.length > 0 && (
          <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <ul className="space-y-0.5">
              {imageWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || uploading}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          <Button type="button" variant="outline" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <ImagePlus data-icon="inline-start" />}
            {uploading ? "Učitavanje…" : "Učitaj sliku"}
          </Button>
          {hasSuggested && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploading}
              onClick={() => patch({ imageUrl: suggestedImageUrl || "" })}
            >
              Koristi predloženu sliku
            </Button>
          )}
          {value.imageUrl && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploading}
              onClick={() => onChange({ imageUrl: "" })}
            >
              <X data-icon="inline-start" />
              Ukloni
            </Button>
          )}
        </div>
        <FieldDescription>
          {fit === "cover"
            ? "JPEG, PNG ili WebP do 5MB. Detail čuva originalni omjer slike; kartice koriste 4:3 crop. Preporučeno najmanje 1200px širine. Možeš i zalijepiti sliku (⌘V)."
            : "JPEG, PNG ili WebP do 5MB. Možeš i zalijepiti sliku (⌘V)."}
        </FieldDescription>
      </Field>

      {!hideUrlField && (
        <Field>
          <FieldLabel htmlFor="imageUrl">URL slike</FieldLabel>
          <Input id="imageUrl" value={value.imageUrl} disabled={disabled || uploading} onChange={(e) => patch({ imageUrl: e.target.value })} />
        </Field>
      )}
    </FieldGroup>
  )
}
