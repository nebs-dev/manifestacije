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
  approved: { tone: "info", label: "Odobreno" },
  published: { tone: "success", label: "Objavljeno" },
  rejected: { tone: "danger", label: "Odbijeno" },
  archived: { tone: "neutral", label: "Arhivirano" },
  // event statuses (uppercase backend fallback)
  PENDING_REVIEW: { tone: "warning", label: "Na čekanju" },
  PUBLISHED: { tone: "success", label: "Objavljeno" },
  REJECTED: { tone: "danger", label: "Odbijeno" },
  // duplicate statuses
  open: { tone: "warning", label: "Otvoreno" },
  merged: { tone: "success", label: "Spojeno" },
  dismissed: { tone: "neutral", label: "Odbačeno" },
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
