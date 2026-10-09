"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export type DuplicateCheckInput = {
  title?: string; startsAt?: string; endsAt?: string | null; isAllDay?: boolean;
  occurrences?: Array<{ startsAt: string; endsAt?: string | null; isAllDay?: boolean }>;
  cityId?: number | null; cityName?: string; venueName?: string; address?: string; sourceUrl?: string | null; repeatWeeklyUntil?: string;
}
type Match = { id: number; title: string; startsAt: string; endsAt: string; isAllDay: boolean; cityName: string | null; venueName: string | null; address: string | null; reasons: string[]; href: string }
type Result = { matches: Match[]; hiddenMatch: boolean; unavailable?: boolean }
type Fetcher = (path: string, init?: RequestInit) => Promise<Response>
const empty = (): Result => ({ matches: [], hiddenMatch: false })
const hasWarnings = (result: Result) => result.unavailable || result.hiddenMatch || result.matches.length > 0

// Stable, shared request shape. Unrelated description/price edits do not check again.
export function duplicateCheckInput(value: DuplicateCheckInput): DuplicateCheckInput {
  return { title: value.title, startsAt: value.startsAt, endsAt: value.endsAt, isAllDay: value.isAllDay,
    occurrences: value.occurrences?.map(({ startsAt, endsAt, isAllDay }) => ({ startsAt, endsAt, isAllDay })),
    cityId: value.cityId, cityName: value.cityName, venueName: value.venueName, address: value.address, sourceUrl: value.sourceUrl, repeatWeeklyUntil: value.repeatWeeklyUntil }
}
export function useEventDuplicateCheck(input: DuplicateCheckInput | null, fetcher: Fetcher, endpoint: string) {
  const key = JSON.stringify(input ? duplicateCheckInput(input) : null)
  const [result, setResult] = useState<Result>(empty)
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pending = useRef<((approved: boolean) => void) | null>(null)
  const sequence = useRef(0)
  const invalidate = useCallback(() => { ++sequence.current }, [])
  const saving = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const finish = useCallback((approved: boolean) => { pending.current?.(approved); pending.current = null; setConfirming(false) }, [])
  const cancelPending = useCallback(() => {
    if (!saving.current) return
    ++sequence.current
    finish(false)
    setChecking(false)
  }, [finish])
  const request = useCallback(async (payload: DuplicateCheckInput, signal?: AbortSignal): Promise<Result> => {
    try {
      const response = await fetcher(endpoint, { method: "POST", body: JSON.stringify(duplicateCheckInput(payload)), signal: signal || AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error()
      return await response.json() as Result
    } catch { return { ...empty(), unavailable: true } }
  }, [fetcher, endpoint])
  useEffect(() => {
    const ticket = ++sequence.current, controller = new AbortController()
    const cleanup = () => { invalidate(); clearTimeout(timerRef.current); controller.abort(); pending.current?.(false); pending.current = null }
    finish(false); setResult(empty()); setChecking(false)
    const payload = JSON.parse(key) as DuplicateCheckInput | null
    if (!payload?.title?.trim() || !(payload.startsAt || payload.occurrences?.length)) return cleanup
    timerRef.current = setTimeout(async () => {
      setChecking(true)
      const found = await request(payload, controller.signal)
      if (ticket === sequence.current) { setResult(found); setChecking(false) }
    }, 600)
    return cleanup
  }, [key, request, finish, invalidate])
  const beforeSave = async (payload: DuplicateCheckInput) => {
    if (saving.current) return false
    saving.current = true
    try {
      clearTimeout(timerRef.current)
      const ticket = ++sequence.current
      setChecking(true)
      const found = await request(payload)
      if (ticket !== sequence.current) return false // form changed while checking
      setChecking(false); setResult(found)
      if (!hasWarnings(found)) return true
      setConfirming(true)
      return await new Promise<boolean>(resolve => { pending.current = resolve })
    } finally { saving.current = false }
  }
  const warning = <EventDuplicateWarning result={result} checking={checking} confirming={confirming} onContinue={() => finish(true)} onCancel={() => finish(false)} />
  return { warning, beforeSave, cancelPending }
}

export function EventDuplicateWarning({ result, checking, confirming, onContinue, onCancel }: { result: Result; checking: boolean; confirming: boolean; onContinue: () => void; onCancel: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { if (confirming) { panel.current?.focus(); panel.current?.scrollIntoView?.({ block: "center", behavior: "smooth" }) } }, [confirming])
  if (!hasWarnings(result) && !checking) return null
  const date = (value: string, allDay: boolean) => new Intl.DateTimeFormat("hr-HR", { timeZone: "Europe/Zagreb", dateStyle: "medium", ...(allDay ? {} : { timeStyle: "short" as const }) }).format(new Date(value))
  return <div ref={panel} tabIndex={-1} role={hasWarnings(result) ? "alert" : "status"} className="w-full rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm space-y-3">
    <p className="font-semibold">{checking ? "Provjera mogućih duplikata…" : result.unavailable ? "Provjera duplikata trenutačno nije dostupna." : "Mogući duplikat — provjerite prije kreiranja"}</p>
    {result.hiddenMatch && <p>Postoji mogući sličan unos čiji podaci nisu dostupni vašem računu. Možete nastaviti s unosom; administrator će provjeriti podudaranje.</p>}
    {result.matches.map(match => <div key={match.id} className="space-y-1 border-t border-warning/30 pt-2">
      <strong className="break-words">{match.title}</strong>
      <p>{date(match.startsAt, match.isAllDay)}{match.endsAt !== match.startsAt && ` – ${date(match.endsAt, match.isAllDay)}`}{match.isAllDay && " · Cjelodnevno"}</p>
      <p>{[match.venueName, match.address, match.cityName].filter(Boolean).join(" · ") || "Mjesto nije navedeno"}</p>
      <p className="text-muted-foreground">{match.reasons.join(" · ")}</p>
      {/* Only server-generated internal paths, never a source or user-entered URL. */}
      {/^\/(?:admin\/events|organizer\/events|eventi)\/[^/]+$/.test(match.href) && <Link className="underline" href={match.href} target="_blank" rel="noopener noreferrer">Otvori postojeći događaj</Link>}
    </div>)}
    {confirming && <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={onContinue}>Svejedno kreiraj događaj</Button>
      <Button type="button" variant="ghost" onClick={onCancel}>Odustani i nastavi uređivati</Button>
    </div>}
    {!confirming && hasWarnings(result) && <p>Upozorenje ne sprječava unos. Pri spremanju možete potvrditi nastavak.</p>}
  </div>
}
