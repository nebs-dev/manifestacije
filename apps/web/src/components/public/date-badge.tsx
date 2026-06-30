import { dateParts } from "@/lib/data"
import { cn } from "@/lib/utils"

interface DateBadgeProps {
  date: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function DateBadge({ date, size = "md", className }: DateBadgeProps) {
  const { day, month } = dateParts(date)

  const sizes = {
    sm: "h-11 w-11 rounded-xl",
    md: "h-14 w-14 rounded-2xl",
    lg: "h-20 w-20 rounded-2xl",
  }
  const dayText = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-card text-card-foreground shadow-poster",
        sizes[size],
        className,
      )}
    >
      <span className={cn("font-heading font-bold leading-none", dayText[size])}>
        {day}
      </span>
      <span className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-accent-foreground/80">
        {month}
      </span>
    </div>
  )
}
