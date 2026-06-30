import Link from "next/link"
import { MapPin } from "lucide-react"
import { categories, regions } from "@/lib/data"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <MapPin className="size-5" />
              </span>
              <span className="font-heading text-xl font-bold">
                Manifestacije
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              Otkrij što se događa u Hrvatskoj — manifestacije, koncerti,
              radionice i skriveni lokalni događaji, po regijama i datumu.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Kategorije
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/kategorije/${c.slug}`}
                    className="text-ink-foreground/80 transition-colors hover:text-accent"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Regije
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {regions.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/regije/${r.slug}`}
                    className="text-ink-foreground/80 transition-colors hover:text-accent"
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Platforma
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/eventi" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Svi događaji
                </Link>
              </li>
              <li>
                <Link href="/mapa" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Karta
                </Link>
              </li>
              <li>
                <Link href="/dodaj-event" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Dodaj event
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Manifestacije · Otkrij Hrvatsku</p>
          <p>Izrađeno s ljubavlju za lokalnu kulturu.</p>
        </div>
      </div>
    </footer>
  )
}
