import { ArrowRight, Megaphone, BarChart3, CalendarPlus } from "lucide-react"

const perks = [
  {
    icon: CalendarPlus,
    title: "Objavi u par minuta",
    text: "Jednostavna forma za unos događaja, slika i ulaznica.",
  },
  {
    icon: Megaphone,
    title: "Doseg po regijama",
    text: "Tvoj program pronalaze posjetitelji upravo u tvom kraju.",
  },
  {
    icon: BarChart3,
    title: "Statistika pregleda",
    text: "Prati interes publike i optimiziraj svoju promociju.",
  },
]

export function OrganizerCta() {
  return (
    <section
      id="organizatori"
      className="relative overflow-hidden bg-ink text-ink-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/3 size-96 rounded-full bg-primary/40 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent">
              Za organizatore
            </span>
            <h2 className="mt-5 font-heading text-4xl font-bold leading-tight text-balance sm:text-5xl">
              Organizirate događaj? Neka ga svi pronađu.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">
              Od malih radionica do velikih festivala — objavite svoj program
              besplatno i dosegnite ljude koji traže baš ono što nudite.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5"
              >
                Dodaj event
                <ArrowRight className="size-4" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-ink-foreground transition-colors hover:bg-white/10"
              >
                Saznaj više
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            {perks.map((p) => (
              <div
                key={p.title}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-ink-card p-5"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-heading text-lg font-semibold">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
