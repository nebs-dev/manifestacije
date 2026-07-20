"use client"

import { useState, type ReactNode } from "react"
import { Inbox, TriangleAlert, RefreshCw, Trash2, Check, X } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={buttonVariants({ size: "icon-sm", variant: "ghost", className: "text-muted-foreground hover:text-destructive" })}
            aria-label={label}
            onClick={() => setConfirming(true)}
          />
        }
      >
        <Trash2 />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ConfirmIconAction({
  icon,
  label,
  confirmLabel = "Sigurno?",
  onConfirm,
  className,
}: {
  icon: ReactNode
  label: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  className?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{confirmLabel}</span>
        <Button
          size="icon-sm"
          variant="outline"
          className="text-success"
          aria-label="Potvrdi"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
              setConfirming(false)
            }
          }}
        >
          <Check />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Odustani" onClick={() => setConfirming(false)} disabled={busy}>
          <X />
        </Button>
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={buttonVariants({ size: "icon-sm", variant: "ghost", className })}
            aria-label={label}
            onClick={() => setConfirming(true)}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
