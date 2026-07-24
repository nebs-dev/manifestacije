"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock, Link2, CopyCheck, CalendarCheck } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/admin/status-badge"
import { ConfidenceBadge } from "@/components/admin/confidence-badge"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authedFetch } from "@/lib/admin/api"
import { adaptEventSource, adaptEvent } from "@/lib/admin/adapters"
import { formatDate, formatRelative } from "@/lib/admin/format"
import type { EventSource, AdminEvent } from "@/lib/admin/types"

function responseItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: Record<string, unknown>[] }).items
  }
  return []
}

function responseTotal(data: unknown, fallback: number) {
  return data && typeof data === "object" && typeof (data as { total?: unknown }).total === "number"
    ? (data as { total: number }).total
    : fallback
}

export default function DashboardPage() {
  const [sources, setSources] = useState<EventSource[]>([])
  const [pending, setPending] = useState<AdminEvent[]>([])
  const [counts, setCounts] = useState({ sources: 0, pending: 0, duplicates: 0, published: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const [srcRes, pendRes, dupRes, evRes] = await Promise.all([
          authedFetch("/api/admin/event-sources"),
          authedFetch("/api/admin/events/pending"),
          authedFetch("/api/admin/duplicates"),
          authedFetch("/api/admin/events?status=PUBLISHED&pageSize=10"),
        ])
        if (!srcRes.ok || !pendRes.ok) {
          setError("Greška pri učitavanju. Provjerite jeste li prijavljeni.")
          return
        }
        const [srcData, pendData, dupData, evData] = await Promise.all([
          srcRes.json(),
          pendRes.json(),
          dupRes.ok ? dupRes.json() : [],
          evRes.ok ? evRes.json() : [],
        ])
        const adaptedSrc = (srcData as Record<string, unknown>[]).map(adaptEventSource)
        const adaptedPend = responseItems(pendData).map(adaptEvent)
        const adaptedAll = responseItems(evData).map(adaptEvent)
        setSources(adaptedSrc.slice(0, 5))
        setPending(adaptedPend.slice(0, 5))
        setCounts({
          sources: adaptedSrc.filter((s) => s.status === "needs_review" || s.status === "parsed").length,
          pending: responseTotal(pendData, adaptedPend.length),
          duplicates: Array.isArray(dupData)
            ? dupData.filter((d: Record<string, unknown>) => d.status === "OPEN").length
            : 0,
          published: responseTotal(evData, adaptedAll.length),
        })
      } catch {
        setError("Greška pri dohvaćanju podataka.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const queues = [
    { label: "Izvori za pregled", value: counts.sources, href: "/admin/sources", icon: Link2 },
    { label: "Događaji na čekanju", value: counts.pending, href: "/admin/events/pending", icon: Clock },
    { label: "Otvoreni duplikati", value: counts.duplicates, href: "/admin/duplicates", icon: CopyCheck },
    { label: "Objavljeni događaji", value: counts.published, href: "/admin/events", icon: CalendarCheck },
  ]

  if (error) return <ErrorState description={error} />

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Pregled radnih redova za prikupljanje i moderiranje događaja."
        breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
        actions={
          <Button nativeButton={false} render={<Link href="/admin/sources" />}>
            <Link2 data-icon="inline-start" />
            Novi izvor
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {queues.map((q) => {
          const Icon = q.icon
          return (
            <Card key={q.label} size="sm">
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <Icon className="size-4" />
                  {q.label}
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {loading ? "—" : q.value}
                </CardTitle>
              </CardHeader>
              <CardFooter>
                <Link
                  href={q.href}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Otvori
                  <ArrowRight className="size-3.5" />
                </Link>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nedavni izvori</CardTitle>
            <CardDescription>Najnoviji prikupljeni izvori događaja.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableLoadingState rows={4} columns={4} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Izvor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Pouzdanost</TableHead>
                      <TableHead className="text-right">Dodano</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="max-w-[260px]">
                          <Link
                            href={`/admin/sources/${s.id}`}
                            className="block truncate font-medium text-foreground hover:underline"
                          >
                            {s.subject}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">
                            {s.sourceUrl}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {s.confidence > 0 ? (
                            <ConfidenceBadge value={s.confidence} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                          {formatRelative(s.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sljedeće za objavu</CardTitle>
            <CardDescription>Događaji koji čekaju pregled.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableLoadingState rows={4} columns={2} />
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <Link
                      href={`/admin/events/${e.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {e.title}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(e.startsAt)}</span>
                      <span aria-hidden>·</span>
                      <span>{e.city ?? "Bez lokacije"}</span>
                    </div>
                  </li>
                ))}
                {pending.length === 0 && (
                  <li className="text-sm text-muted-foreground">Nema događaja na čekanju.</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
