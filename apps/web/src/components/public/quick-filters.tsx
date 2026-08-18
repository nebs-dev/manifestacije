import Link from "next/link"
import { Sun, CalendarDays, Gift, Baby, Trees } from "lucide-react"
import { cn } from "@/lib/utils"
import { TrackedDiscoveryLink } from "@/components/public/tracked-discovery-link"

const filters = [
  { label: "Danas", href: "/danas", icon: Sun },
  { label: "Ovaj vikend", href: "/ovaj-vikend", icon: CalendarDays },
  { label: "Besplatno", href: "/eventi?besplatno=1", icon: Gift },
  { label: "Za djecu", href: "/eventi?djeca=1", icon: Baby },
  { label: "Na otvorenom", href: "/eventi?vani=1", icon: Trees },
] as const

export function QuickFilters({
  variant = "light",
  className,
}: {
  variant?: "light" | "ink"
  className?: string
}) {
  const isInk = variant === "ink"
  return (
    <div className={cn("flex flex-wrap justify-center gap-2.5", className)}>
      {filters.map((f) => (
        f.href === "/ovaj-vikend" ? (
          <TrackedDiscoveryLink
            key={f.label}
            href="/ovaj-vikend"
            sourcePage="home"
            sourceComponent="quick_filter"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5",
              isInk
                ? "border-white/15 bg-white/5 text-ink-foreground hover:bg-white/10"
                : "border-border bg-card text-foreground hover:bg-muted shadow-poster",
            )}
          >
            <f.icon className="size-4 text-accent" />
            {f.label}
          </TrackedDiscoveryLink>
        ) : (
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
        )
      ))}
    </div>
  )
}
