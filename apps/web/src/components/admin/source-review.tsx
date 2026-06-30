"use client"

import { ChevronDown, RefreshCw, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { EmptyState } from "@/components/admin/states"
import { formatDateTime } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import type { EventSource, ParsedCandidate } from "@/lib/admin/types"

const typeLabels: Record<string, string> = {
  url: "URL",
  manual: "Ručno",
  portal: "Portal",
  organizer: "Organizator",
  "tourist-board": "Turistička zajednica",
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

export function SourceReview({
  source,
  candidates,
  onReparse,
}: {
  source: EventSource
  candidates: ParsedCandidate[]
  onReparse?: () => void
}) {
  async function handleReparse() {
    const res = await authedFetch(
      `/api/admin/event-sources/${source.id}/reparse`,
      { method: "POST" }
    )
    if (res.ok) {
      toast.success("Reparsiranje završeno")
      onReparse?.()
    } else {
      toast.error("Reparsiranje neuspješno")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{source.subject}</CardTitle>
              <CardDescription>Sažetak izvora i dokazi parsiranja.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleReparse}>
              <RefreshCw data-icon="inline-start" />
              Ponovno parsiraj
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryRow
            label="URL izvora"
            value={
              source.sourceUrl ? (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <span className="truncate">{source.sourceUrl}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ) : (
                "—"
              )
            }
          />
          <SummaryRow label="Tip" value={typeLabels[source.type] ?? source.type} />
          <SummaryRow label="Status" value={<StatusBadge status={source.status} />} />
          <SummaryRow
            label="Pouzdanost"
            value={
              source.confidence > 0 ? (
                <ConfidenceBadge value={source.confidence} />
              ) : (
                "—"
              )
            }
          />
          <SummaryRow label="Pošiljatelj" value={source.from || "—"} />
          <SummaryRow label="Kandidati" value={source.candidateCount} />
          <SummaryRow label="Kreirano" value={formatDateTime(source.createdAt)} />
        </CardContent>
      </Card>

      {source.rawText && (
        <Card>
          <Collapsible defaultOpen={false}>
            <CardHeader>
              <CollapsibleTrigger
                render={
                  <button
                    type="button"
                    className="group/raw flex w-full items-center justify-between gap-2 text-left"
                  />
                }
              >
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="text-base">Neobrađeni tekst izvora</CardTitle>
                  <CardDescription>Originalni tekst korišten za parsiranje.</CardDescription>
                </div>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/raw:rotate-180" />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <Separator className="mb-4" />
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                  {source.rawText}
                </pre>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Parsirani kandidati</h2>
          <span className="text-sm text-muted-foreground">
            {candidates.length} ukupno
          </span>
        </div>

        {candidates.length === 0 ? (
          <EmptyState
            title="Nema kandidata"
            description="Ovaj izvor još nije dao nijednog kandidata za događaj."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {candidates.map((c) => (
              <ParsedCandidateCard
                key={c.id}
                candidate={c}
                onUpdate={onReparse}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
