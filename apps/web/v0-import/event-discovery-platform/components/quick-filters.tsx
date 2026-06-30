import Link from "next/link"
import { Sun, CalendarDays, Gift, Baby, Trees } from "lucide-react"
import { cn } from "@/lib/utils"

const filters = [
  { label: "Danas", href: "/dogadjaji?kada=danas", icon: Sun },
  { label: "Ovaj vikend", href: "/dogadjaji?kada=vikend", icon: CalendarDays },
  { label: "Besplatno", href: "/dogadjaji?cijena=besplatno", icon: Gift },
  { label: "Za djecu", href: "/dogadjaji?publika=djeca", icon: Baby },
  { label: "Na otvorenom", href: "/dogadjaji?mjesto=otvoreno", icon: Trees },
]

export function QuickFilters({
  variant = "light",
  className,
}: {
  variant?: "light" | "ink"
  className?: string
}) {
  const isInk = variant === "ink"
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {filters.map((f) => (
        <Link
          key={f.label}
          href={f.href}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5",
            isInk
              ? "border-white/15 bg-white/5 text-ink-foreground hover:bg-white/10"
              : "border-border bg-card text-foreground hover:bg-muted shadow-poster",
          )}
        >
          <f.icon className="size-4 text-accent" />
          {f.label}
        </Link>
      ))}
    </div>
  )
}
