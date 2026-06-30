import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  href?: string
  hrefLabel?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "Pogledaj sve",
}: SectionHeadingProps) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4 sm:items-end">
      <div className="max-w-2xl">
        {eyebrow && (
          <span className="text-sm font-semibold uppercase tracking-wider text-accent-foreground/80">
            {eyebrow}
          </span>
        )}
        <h2 className="mt-2 font-heading text-3xl font-bold leading-tight text-balance sm:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          {hrefLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
