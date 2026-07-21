import Link from "next/link"
import type { SeoCategoryLink } from "@/lib/seo-taxonomy"

export function SeoLinkBlock({
  title,
  links,
}: {
  title: string
  links: SeoCategoryLink[]
}) {
  if (links.length === 0) return null

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            {link.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

