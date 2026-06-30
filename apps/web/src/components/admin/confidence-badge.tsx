import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatPercent } from "@/lib/admin/format"

export function ConfidenceBadge({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const tone =
    value >= 0.8
      ? "bg-success/10 text-success"
      : value >= 0.55
        ? "bg-warning/10 text-warning"
        : "bg-destructive/10 text-destructive"

  return (
    <Badge
      variant="secondary"
      className={cn("rounded-md font-mono tabular-nums", tone, className)}
    >
      {formatPercent(value)}
    </Badge>
  )
}
