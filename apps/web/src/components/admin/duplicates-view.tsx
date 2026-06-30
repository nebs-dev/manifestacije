"use client"

import { useState } from "react"
import { GitMerge, X, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfidenceBadge } from "@/components/admin/confidence-badge"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { formatDate } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import type { DuplicateCandidate } from "@/lib/admin/types"

function EventColumn({
  label,
  event,
}: {
  label: string
  event: DuplicateCandidate["eventA"]
}) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium text-pretty">{event.title}</div>
      <dl className="mt-3 flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Datum</dt>
          <dd className="tabular-nums">{formatDate(event.startsAt)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Grad</dt>
          <dd>{event.city ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-mono text-xs text-muted-foreground">{event.id}</dd>
        </div>
      </dl>
    </div>
  )
}

export function DuplicatesView({
  items,
  onAction,
}: {
  items: DuplicateCandidate[]
  onAction?: () => void
}) {
  const [resolved, setResolved] = useState<Record<string, string>>({})

  const open = items.filter((d) => d.status === "open" && !resolved[d.id])

  async function resolve(
    id: string,
    action: "merge" | "dismiss",
    title: string
  ) {
    const res = await authedFetch(`/api/admin/duplicates/${id}/${action}`, {
      method: "POST",
    })
    if (res.ok) {
      setResolved((prev) => ({
        ...prev,
        [id]: action === "merge" ? "merged" : "dismissed",
      }))
      toast.success(
        action === "merge" ? "Događaji spojeni" : "Prijedlog odbačen",
        { description: title }
      )
      onAction?.()
    } else {
      toast.error("Greška", { description: await res.text() })
    }
  }

  if (open.length === 0) {
    return (
      <Empty>
        <EmptyTitle>Nema otvorenih duplikata</EmptyTitle>
        <EmptyDescription>
          Svi predloženi duplikati su riješeni. Novi prijedlozi pojavit će se
          ovdje kad sustav pronađe slične događaje.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {open.map((dup) => (
        <Card key={dup.id}>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Mogući duplikat</CardTitle>
              <ConfidenceBadge value={dup.score} />
            </div>
            <Badge variant="outline">{dup.reason}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
              <EventColumn label="Postojeći" event={dup.eventA} />
              <EventColumn label="Novi" event={dup.eventB} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => resolve(dup.id, "merge", dup.eventB.title)}
              >
                <GitMerge data-icon="inline-start" />
                Spoji događaje
              </Button>
              <Button
                variant="outline"
                onClick={() => resolve(dup.id, "dismiss", dup.eventB.title)}
              >
                <X data-icon="inline-start" />
                Nisu duplikati
              </Button>
              <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
                <Check className="size-3.5" />
                Zadrži oba kao zasebne
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
