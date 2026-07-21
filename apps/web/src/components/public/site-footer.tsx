import Image from "next/image"
import Link from "next/link"
import { categories } from "@/lib/data"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo/logo.svg" alt="Manifestacije" width={36} height={36} className="size-9 rounded-xl" />
              <span className="font-heading text-xl font-bold">
                Manifestacije
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              Otkrij što se događa u Slavoniji i Baranji — manifestacije, koncerti,
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
              Otkrij
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/danas" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Danas
                </Link>
              </li>
              <li>
                <Link href="/ovaj-vikend" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Ovaj vikend
                </Link>
              </li>
              <li>
                <Link href="/kalendar" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Kalendar
                </Link>
              </li>
              <li>
                <Link href="/gradovi" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Gradovi
                </Link>
              </li>
              <li>
                <Link href="/regije" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Regije
                </Link>
              </li>
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
              <li>
                <Link href="/organizer/login" className="text-ink-foreground/80 transition-colors hover:text-accent">
                  Prijava organizatora
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Manifestacije · Otkrij Slavoniju i Baranju</p>
          <div className="flex gap-4">
            <Link href="/pravila-privatnosti" className="hover:text-ink-foreground/80 transition-colors">Privatnost</Link>
            <Link href="/uvjeti-koristenja" className="hover:text-ink-foreground/80 transition-colors">Uvjeti</Link>
            <Link href="/kolacici" className="hover:text-ink-foreground/80 transition-colors">Kolačići</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
