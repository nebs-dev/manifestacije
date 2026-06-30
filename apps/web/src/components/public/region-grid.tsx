import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { regions, eventsByRegion, type CroEvent } from "@/lib/data"

export function RegionGrid({ events }: { events?: CroEvent[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {regions.map((region) => {
        const count = events ? events.filter((event) => event.region === region.slug).length : eventsByRegion(region.slug).length
        return (
          <Link
            key={region.slug}
            href={`/regije/${region.slug}`}
            className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-ink text-ink-foreground shadow-poster transition-shadow hover:shadow-poster-lg"
          >
            <Image
              src={region.image || "/placeholder.svg"}
              alt={region.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" aria-hidden />
            <div className="relative p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-xl font-semibold">{region.name}</h3>
                <ArrowUpRight className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </div>
              <p className="mt-1 text-sm text-ink-foreground/70">{count} događanja</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
