"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { authedFetch } from "@/lib/admin/api"
import { notificationLabels, notificationsChanged, type AdminNotification, type NotificationKind } from "@/lib/admin/notifications"
import { Button } from "@/components/ui/button"

type List = { items: AdminNotification[]; total: number; pageCount: number }
type Counts = { unread: number; pending: number; categories: Record<NotificationKind, { unread: number; pending: number }> }

export function NotificationsPage() {
  const [page, setPage] = useState(1), [data, setData] = useState<List | null>(null), [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const reload = useCallback(() => setRefresh(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError("")
    Promise.all(["/api/admin/notifications?page=" + page, "/api/admin/notifications/counts"].map(async url => {
      const response = await authedFetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error("Obavijesti nije moguće učitati.")
      return response.json()
    })).then(([list, summary]) => { if (!controller.signal.aborted) { setData(list); setCounts(summary) } })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, refresh])

  async function mark(key?: string) {
    setBusy(true); setError("")
    try {
      const response = await authedFetch(`/api/admin/notifications/${key ? "read" : "read-all"}`, { method: "POST", ...(key ? { body: JSON.stringify({ key }) } : {}) })
      if (!response.ok) throw new Error("Pročitano stanje nije spremljeno. Pokušajte ponovno.")
      notificationsChanged(); reload()
    } catch (error) { setError(error instanceof Error ? error.message : "Greška pri spremanju.") }
    finally { setBusy(false) }
  }

  return <section className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-heading text-2xl font-semibold">Obavijesti</h1>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={reload} disabled={loading || busy}>Osvježi</Button>
        <Button onClick={() => mark()} disabled={loading || busy || !counts?.unread}>Označi sve kao pročitano</Button></div>
    </div>
    <p className="text-sm text-muted-foreground">Pročitano stanje vrijedi samo za vaš račun. Čitanje ne odobrava, odbija niti objavljuje sadržaj.</p>
    {counts && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(notificationLabels).map(([kind, label]) => {
      const category = counts.categories[kind as NotificationKind]
      return <div key={kind} className="rounded-lg border p-3 text-sm"><p className="font-medium">{label}</p>
        <p>{category?.unread ?? 0} nepročitano{category?.pending ? ` · ${category.pending} čeka pregled` : ""}</p></div>
    })}</div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading ? <p role="status">Učitavanje obavijesti…</p> : !data?.items.length ? <p role="status">Nema obavijesti.</p> :
      <ul className="flex flex-col gap-3">{data.items.map(item => <li key={item.key} className={`rounded-lg border p-4 ${item.readAt ? "" : "border-primary/40 bg-primary/5"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1 break-words">
          <p className="text-sm text-muted-foreground">{notificationLabels[item.kind]}</p>
          <Link href={item.href} className={`text-primary underline ${item.readAt ? "font-medium" : "font-bold"}`}>{item.title}</Link>
          <p className="mt-1 text-sm">{item.readAt ? "Pročitano" : "Nepročitano"} · {item.requiresAction ? "Čeka pregled" : item.kind === "autoPublished" ? "Objavljeno — informativno" : "Registracija — informativno"}</p>
          <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb" })}</time>
        </div>{!item.readAt && <Button variant="outline" size="sm" disabled={busy} onClick={() => mark(item.key)}>Označi kao pročitano</Button>}</div>
      </li>)}</ul>}
    {data && data.pageCount > 1 && <nav aria-label="Stranice obavijesti" className="flex items-center gap-3">
      <Button variant="outline" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Prethodna</Button>
      <span>{page} / {data.pageCount}</span><Button variant="outline" disabled={page >= data.pageCount || loading} onClick={() => setPage(value => value + 1)}>Sljedeća</Button>
    </nav>}
  </section>
}
