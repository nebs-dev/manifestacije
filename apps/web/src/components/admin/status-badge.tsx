import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "success" | "warning" | "danger"

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

const statusMap: Record<string, { tone: Tone; label: string }> = {
  // source statuses (lowercase)
  queued: { tone: "neutral", label: "U redu" },
  parsing: { tone: "info", label: "Parsiranje" },
  parsed: { tone: "info", label: "Parsirano" },
  needs_review: { tone: "warning", label: "Za pregled" },
  error: { tone: "danger", label: "Greška" },
  done: { tone: "success", label: "Gotovo" },
  // source statuses (uppercase backend fallback)
  NEW: { tone: "neutral", label: "U redu" },
  PARSED: { tone: "info", label: "Parsirano" },
  NEEDS_REVIEW: { tone: "warning", label: "Za pregled" },
  LINKED: { tone: "success", label: "Gotovo" },
  // event statuses (lowercase)
  draft: { tone: "neutral", label: "Skica" },
  pending: { tone: "warning", label: "Na čekanju" },
  published: { tone: "success", label: "Objavljeno" },
  rejected: { tone: "danger", label: "Odbijeno" },
  archived: { tone: "neutral", label: "Arhivirano" },
  // event statuses (uppercase backend fallback)
  DRAFT: { tone: "neutral", label: "Skica" },
  PENDING_REVIEW: { tone: "warning", label: "Na čekanju" },
  PUBLISHED: { tone: "success", label: "Objavljeno" },
  REJECTED: { tone: "danger", label: "Odbijeno" },
  ARCHIVED: { tone: "neutral", label: "Arhivirano" },
  // duplicate statuses
  open: { tone: "warning", label: "Otvoreno" },
  merged: { tone: "success", label: "Spojeno" },
  dismissed: { tone: "neutral", label: "Odbačeno" },
  // monitored source check statuses
  OK: { tone: "success", label: "OK" },
  UNCHANGED: { tone: "neutral", label: "Bez promjena" },
  ERROR: { tone: "danger", label: "Greška" },
  // ingestion job (run log) statuses
  QUEUED: { tone: "neutral", label: "U redu" },
  RUNNING: { tone: "info", label: "U tijeku" },
  DONE: { tone: "success", label: "Gotovo" },
  FAILED: { tone: "danger", label: "Neuspjelo" },
  // organizer claim statuses
  PENDING: { tone: "neutral", label: "Na čekanju" },
  EMAIL_VERIFICATION_SENT: { tone: "info", label: "Poslana poveznica" },
  NEEDS_ADMIN_REVIEW: { tone: "warning", label: "Za pregled" },
  APPROVED: { tone: "info", label: "Odobreno" },
  COMPLETED: { tone: "success", label: "Preuzeto" },
  EXPIRED: { tone: "neutral", label: "Isteklo" },
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const entry = statusMap[status] ?? { tone: "neutral" as Tone, label: status }
  return (
    <Badge
      variant="secondary"
      className={cn("rounded-md", toneClasses[entry.tone], className)}
    >
      {entry.label}
    </Badge>
  )
}
