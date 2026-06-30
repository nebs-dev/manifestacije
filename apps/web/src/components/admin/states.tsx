"use client"

import { useState, type ReactNode } from "react"
import { Inbox, TriangleAlert, RefreshCw, Trash2, Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

export function EmptyState({
  title = "Nema podataka",
  description,
  icon,
  action,
}: {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <Inbox />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

export function ErrorState({
  title = "Nešto je pošlo po zlu",
  description = "Učitavanje podataka nije uspjelo. Pokušajte ponovno.",
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <Empty className="border border-destructive/30 bg-destructive/5">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            Pokušaj ponovno
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

export function DeleteButton({ onDelete, label = "Obriši" }: { onDelete: () => void; label?: string }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-destructive whitespace-nowrap">Sigurno?</span>
        <Button
          size="icon-sm"
          variant="destructive"
          aria-label="Potvrdi brisanje"
          onClick={() => { setConfirming(false); onDelete() }}
        >
          <Check />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Odustani"
          onClick={() => setConfirming(false)}
        >
          <X />
        </Button>
      </span>
    )
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      className="text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 />
    </Button>
  )
}

export function TableLoadingState({
  rows = 5,
  columns = 5,
}: {
  rows?: number
  columns?: number
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-5 flex-1"
              style={{ maxWidth: c === 0 ? "40%" : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
