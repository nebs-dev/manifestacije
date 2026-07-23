"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Search, MapPin, CalendarDays, Loader2 } from "lucide-react"
import { QuickFilters } from "@/components/public/quick-filters"

export function HomeHero() {
  const [searching, setSearching] = useState(false)

  return (
    <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
      <Image
        src="/images/hero-night.jpg"
        alt="Noćni kulturni festival u povijesnoj dalmatinskoj jezgri"
        fill
        priority
        className="object-cover object-center opacity-60"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/55 to-ink" aria-hidden />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-20 text-center sm:pt-28 md:pb-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/20 bg-ink-foreground/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-ink-foreground/80 backdrop-blur">
          Manje skrolanja, više manifestacija.
        </span>
        <h1 className="mt-6 max-w-3xl text-balance font-heading text-4xl font-semibold leading-[1.05] sm:text-5xl md:text-6xl">
          Što se događa oko tebe?
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink-foreground/75 sm:text-lg">
          Pronađi mjesto, manifestaciju ili dobar razlog da ne ostaneš doma.
        </p>

        {/* Search bar */}
        <form
          action="/eventi"
          onSubmit={() => setSearching(true)}
          className="mt-9 flex w-full max-w-2xl flex-col gap-2 rounded-2xl bg-background p-2 text-foreground shadow-poster-lg sm:flex-row sm:items-center sm:rounded-full"
        >
          <label className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 sm:rounded-full">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Pretraži događaje</span>
            <input
              type="search"
              name="q"
              placeholder="Pretraži događaje, izvođače, mjesta…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <label className="flex items-center gap-2 rounded-xl px-3 py-2.5 sm:rounded-full">
            <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Lokacija</span>
            <input
              type="text"
              name="grad"
              placeholder="Bilo gdje"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-28"
            />
          </label>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:rounded-full"
          >
            {searching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            {searching ? "Tražim…" : "Traži"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-foreground/70">
          <Link href="/mapa" className="inline-flex items-center gap-1.5 hover:text-ink-foreground">
            <MapPin className="size-4" aria-hidden />
            Istraži na karti
          </Link>
          <Link href="/eventi?kada=ovaj-vikend" className="inline-flex items-center gap-1.5 hover:text-ink-foreground">
            <CalendarDays className="size-4" aria-hidden />
            Ovaj vikend
          </Link>
        </div>

        <div className="mt-10 w-full">
          <QuickFilters />
        </div>
      </div>
    </section>
  )
}
