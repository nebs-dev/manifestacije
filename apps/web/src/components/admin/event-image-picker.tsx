"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { authedFetch } from "@/lib/admin/api"

export type EventImageValue = {
  imageUrl: string
  imageAlt: string
  imageCredit: string
  imageSourceUrl: string
}

export function EventImagePicker({
  value,
  onChange,
  disabled,
  suggestedImageUrl,
  suggestedImageSourceUrl,
}: {
  value: EventImageValue
  onChange: (value: EventImageValue) => void
  disabled?: boolean
  suggestedImageUrl?: string | null
  suggestedImageSourceUrl?: string | null
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

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
      const res = await authedFetch("/api/admin/uploads/event-image", {
        method: "POST",
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { imageUrl: string }
      patch({ imageUrl: data.imageUrl, imageSourceUrl: "" })
      toast.success("Slika učitana")
    } catch (err) {
      toast.error("Upload slike nije uspio", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const hasSuggested = Boolean(suggestedImageUrl) && suggestedImageUrl !== value.imageUrl

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Slika događaja</FieldLabel>
        <div className="overflow-hidden rounded-2xl border border-border bg-muted">
          {value.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.imageUrl} alt={value.imageAlt || "Slika događaja"} className="aspect-video w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
              Nema slike
            </div>
          )}
        </div>
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
              onClick={() => patch({ imageUrl: suggestedImageUrl || "", imageSourceUrl: suggestedImageSourceUrl || "" })}
            >
              Koristi predloženu sliku
            </Button>
          )}
          {value.imageUrl && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploading}
              onClick={() => onChange({ imageUrl: "", imageAlt: "", imageCredit: "", imageSourceUrl: "" })}
            >
              <X data-icon="inline-start" />
              Ukloni
            </Button>
          )}
        </div>
        <FieldDescription>JPEG, PNG ili WebP do 5MB. Preporučeno: horizontalno, min. 1200×900px (4:3). Možeš i zalijepiti sliku (⌘V).</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="imageUrl">URL slike</FieldLabel>
        <Input id="imageUrl" value={value.imageUrl} disabled={disabled || uploading} onChange={(e) => patch({ imageUrl: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="imageAlt">Alt tekst</FieldLabel>
        <Input id="imageAlt" value={value.imageAlt} disabled={disabled || uploading} onChange={(e) => patch({ imageAlt: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="imageCredit">Autor / kredit</FieldLabel>
        <Input id="imageCredit" value={value.imageCredit} disabled={disabled || uploading} onChange={(e) => patch({ imageCredit: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="imageSourceUrl">URL izvora slike</FieldLabel>
        <Input id="imageSourceUrl" value={value.imageSourceUrl} disabled={disabled || uploading} onChange={(e) => patch({ imageSourceUrl: e.target.value })} />
      </Field>
    </FieldGroup>
  )
}
