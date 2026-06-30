import Link from "next/link"
import { categories, eventsByCategory, type CroEvent } from "@/lib/data"

export function CategoryStrip({ events }: { events?: CroEvent[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={`/kategorije/${cat.slug}`}
          className="group relative isolate flex aspect-[5/3] flex-col justify-end overflow-hidden rounded-2xl p-4 text-ink-foreground shadow-poster transition-transform hover:-translate-y-0.5"
          style={{ background: `linear-gradient(140deg, ${cat.gradient[0]}, ${cat.gradient[1]})` }}
        >
          <span className="absolute inset-0 bg-ink/10 transition-colors group-hover:bg-ink/0" aria-hidden />
          <span className="relative font-heading text-lg font-semibold leading-tight">{cat.name}</span>
          <span className="relative mt-0.5 text-xs text-ink-foreground/80">
            {(events ? events.filter((event) => event.category === cat.slug).length : eventsByCategory(cat.slug).length)} događanja
          </span>
        </Link>
      ))}
    </div>
  )
}
