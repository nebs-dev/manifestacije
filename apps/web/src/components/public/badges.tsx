import { categoryName } from "@/lib/data"
import { cn } from "@/lib/utils"

export function CategoryBadge({
  category,
  label,
  className,
}: {
  category: string
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground",
        className,
      )}
    >
      {label || categoryName(category)}
    </span>
  )
}

export function PriceBadge({
  free,
  price,
  className,
}: {
  free: boolean
  price?: string
  className?: string
}) {
  if (free) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground",
          className,
        )}
      >
        Besplatno
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground",
        className,
      )}
    >
      {price ?? "Naplata"}
    </span>
  )
}

export function MetaTag({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}
