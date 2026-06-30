"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CalendarPlus,
  X,
  MapPin,
  Calendar,
  Tag,
  User,
  Ticket,
  ExternalLink,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ConfidenceBadge } from "@/components/admin/confidence-badge"
import { formatDateTime } from "@/lib/admin/format"
import { authedFetch } from "@/lib/admin/api"
import type { ParsedCandidate } from "@/lib/admin/types"

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | null
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm break-words">{value || "—"}</span>
      </div>
    </div>
  )
}

export function ParsedCandidateCard({
  candidate,
  onUpdate,
}: {
  candidate: ParsedCandidate
  onUpdate?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const location = [candidate.venueName, candidate.city, candidate.region]
    .filter(Boolean)
    .join(", ")

  const isCreated = candidate._status === "created"
  const isIgnored = candidate._status === "ignored"
  const isPending = !isCreated && !isIgnored

  async function createEvent() {
    setBusy(true)
    try {
      const res = await authedFetch(
        `/api/admin/event-sources/${candidate.sourceId}/create-event`,
        {
          method: "POST",
          body: JSON.stringify({ candidateIndex: candidate.candidateIndex }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        toast.success("Događaj kreiran", {
          description: (
            <Link href={`/admin/events/${data.event.id}`} className="underline">
              Event #{data.event.id}
            </Link>
          ) as unknown as string,
        })
        onUpdate?.()
      } else {
        toast.error("Greška pri kreiranju", { description: await res.text() })
      }
    } finally {
      setBusy(false)
    }
  }

  async function ignoreCandidate() {
    setBusy(true)
    try {
      const res = await authedFetch(
        `/api/admin/event-sources/${candidate.sourceId}/ignore-candidate`,
        {
          method: "POST",
          body: JSON.stringify({ candidateIndex: candidate.candidateIndex }),
        }
      )
      if (res.ok) {
        toast.success("Kandidat ignoriran")
        onUpdate?.()
      } else {
        toast.error("Greška", { description: await res.text() })
      }
    } finally {
      setBusy(false)
    }
  }

  const canCreate = !candidate.missingFields.some((f) =>
    ["title", "startsAt", "city", "category"].includes(f)
  )

  return (
    <Card className={isIgnored ? "opacity-50" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{candidate.title || "—"}</CardTitle>
            {isCreated && candidate._eventId && (
              <Link
                href={`/admin/events/${candidate._eventId}`}
                className="text-xs text-success hover:underline"
              >
                Kreiran → Event #{candidate._eventId}
              </Link>
            )}
            {isIgnored && (
              <span className="text-xs text-muted-foreground">Ignorirano</span>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {candidate.description}
            </p>
          </div>
          <ConfidenceBadge value={candidate.confidence} />
        </div>

        <div className="mt-1 flex flex-wrap gap-1.5">
          {candidate.isFree ? (
            <Badge variant="secondary" className="rounded-md bg-success/10 text-success">
              Besplatno
            </Badge>
          ) : (
            candidate.priceText && (
              <Badge variant="outline" className="rounded-md font-normal">
                {candidate.priceText}
              </Badge>
            )
          )}
          {candidate.category && (
            <Badge variant="outline" className="rounded-md font-normal">
              {candidate.category}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailItem
            icon={Calendar}
            label="Početak"
            value={formatDateTime(candidate.startsAt)}
          />
          <DetailItem
            icon={Calendar}
            label="Završetak"
            value={formatDateTime(candidate.endsAt)}
          />
          <DetailItem icon={MapPin} label="Lokacija" value={location || null} />
          <DetailItem icon={Tag} label="Adresa" value={candidate.address} />
          <DetailItem icon={User} label="Organizator" value={candidate.organizerName} />
          <DetailItem icon={Ticket} label="Ulaznice" value={candidate.ticketUrl} />
        </div>

        {(candidate.missingFields.length > 0 || candidate.warnings.length > 0) && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {candidate.missingFields.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Nedostaje:
                  </span>
                  {candidate.missingFields.map((f) => (
                    <Badge
                      key={f}
                      variant="secondary"
                      className="rounded-md bg-warning/10 text-warning"
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              )}
              {candidate.warnings.map((w) => (
                <div
                  key={w}
                  className="flex items-center gap-1.5 text-xs text-destructive"
                >
                  <TriangleAlert className="size-3.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          </>
        )}

        {candidate.sourceUrl && (
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <ExternalLink className="size-3.5" />
            <span className="truncate">{candidate.sourceUrl}</span>
          </a>
        )}
      </CardContent>

      {isPending && (
        <CardFooter className="gap-2">
          <Button onClick={createEvent} disabled={busy || !canCreate}>
            <CalendarPlus data-icon="inline-start" />
            Kreiraj događaj
          </Button>
          <Button variant="outline" onClick={ignoreCandidate} disabled={busy}>
            <X data-icon="inline-start" />
            Ignoriraj
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
