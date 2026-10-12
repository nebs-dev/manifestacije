"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"
import { Bold, Eye, Italic, Link2, List, PencilLine } from "lucide-react"
import { RichText } from "@/components/rich-text"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Props = {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  name?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  id?: string
}

/**
 * Description editor for the EVT-03 Markdown subset: a normal textarea (so
 * pasting from anywhere yields plain text and mobile typing is unaffected)
 * with formatting buttons and a preview of the public rendering.
 */
export function RichTextEditor({ value, defaultValue, onChange, name, rows = 6, placeholder, disabled, id }: Props) {
  const [internal, setInternal] = useState(defaultValue ?? "")
  const [preview, setPreview] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const helpId = useId()
  const text = value ?? internal

  function set(next: string, selection?: [number, number]) {
    if (value === undefined) setInternal(next)
    onChange?.(next)
    if (selection) requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(selection[0], selection[1]) })
  }

  function wrap(marker: string, fallback: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const selected = text.slice(start, end) || fallback
    const next = text.slice(0, start) + marker + selected + marker + text.slice(end)
    set(next, [start + marker.length, start + marker.length + selected.length])
  }

  function link() {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const label = text.slice(start, end) || "tekst poveznice"
    const inserted = `[${label}](https://)`
    const next = text.slice(0, start) + inserted + text.slice(end)
    const urlStart = start + label.length + 3
    set(next, [urlStart, urlStart + "https://".length])
  }

  function list() {
    const el = ref.current
    if (!el) return
    const lineStart = text.lastIndexOf("\n", el.selectionStart - 1) + 1
    const lineEnd = text.indexOf("\n", el.selectionEnd)
    const end = lineEnd === -1 ? text.length : lineEnd
    const lines = text.slice(lineStart, end).split("\n").map((line) => (line.trim() && !/^\s*[-*•]\s+/.test(line) ? `- ${line}` : line))
    const replaced = lines.join("\n")
    set(text.slice(0, lineStart) + replaced + text.slice(end), [lineStart, lineStart + replaced.length])
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.metaKey || event.ctrlKey)) return
    const key = event.key.toLowerCase()
    if (key === "b") { event.preventDefault(); wrap("**", "podebljani tekst") }
    else if (key === "i") { event.preventDefault(); wrap("*", "kurziv") }
    else if (key === "k") { event.preventDefault(); link() }
  }

  const tool = "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
  return (
    <div className="flex flex-col gap-2">
      <div role="toolbar" aria-label="Oblikovanje opisa" className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-muted/30 p-1">
        <button type="button" className={tool} onClick={() => wrap("**", "podebljani tekst")} disabled={disabled || preview} aria-label="Podebljano (Ctrl+B)" title="Podebljano (Ctrl+B)"><Bold className="size-4" aria-hidden /></button>
        <button type="button" className={tool} onClick={() => wrap("*", "kurziv")} disabled={disabled || preview} aria-label="Kurziv (Ctrl+I)" title="Kurziv (Ctrl+I)"><Italic className="size-4" aria-hidden /></button>
        <button type="button" className={tool} onClick={link} disabled={disabled || preview} aria-label="Poveznica (Ctrl+K)" title="Poveznica (Ctrl+K)"><Link2 className="size-4" aria-hidden /></button>
        <button type="button" className={tool} onClick={list} disabled={disabled || preview} aria-label="Popis" title="Popis"><List className="size-4" aria-hidden /></button>
        <button type="button" className={cn(tool, "ml-auto")} onClick={() => setPreview((p) => !p)} disabled={disabled} aria-pressed={preview}>
          {preview ? <PencilLine className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}{preview ? "Uredi" : "Pregled"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-24 rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed">
          {text.trim() ? <RichText source={text} /> : <p className="text-muted-foreground">Opis je prazan.</p>}
        </div>
      ) : null}
      <Textarea
        ref={ref}
        id={id}
        name={name}
        value={text}
        onChange={(event) => set(event.target.value)}
        onKeyDown={onKeyDown}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={helpId}
        className={cn(preview && "hidden")}
      />
      <p id={helpId} className="text-xs text-muted-foreground">
        Oblikovanje: **podebljano**, *kurziv*, [tekst](https://poveznica), redak s „- ” za popis. Prazan red odvaja odlomke.
      </p>
    </div>
  )
}
