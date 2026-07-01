import type { Metadata } from "next"
import { SiteHeader } from "@/components/public/site-header"
import { SiteFooter } from "@/components/public/site-footer"

export const metadata: Metadata = {
  title: "Obavijest o kolačićima — Manifestacije",
  description: "Koje kolačiće koristi Manifestacije.hr i kako ih možete kontrolirati.",
}

export default function KolaciciPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">Obavijest o kolačićima</h1>
        <p className="mt-2 text-sm text-muted-foreground">Zadnja izmjena: 1. srpnja 2026.</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">

          <h2>Što su kolačići?</h2>
          <p>
            Kolačići (cookies) su male tekstualne datoteke koje web stranica pohranjuje u vaš
            pregledavač. Koriste se za pamćenje postavki, prijava i analitičkih podataka.
          </p>

          <h2>Koje kolačiće koristimo</h2>

          <h3>Nužni kolačići</h3>
          <p>
            Ovi kolačići su neophodni za funkcioniranje platforme i ne mogu se isključiti.
          </p>
          <table>
            <thead>
              <tr>
                <th>Naziv</th>
                <th>Svrha</th>
                <th>Trajanje</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>session</code></td>
                <td>Prijava organizatora / administratora</td>
                <td>Do odjave / 7 dana</td>
              </tr>
            </tbody>
          </table>

          <h3>Analitički i marketinški kolačići</h3>
          <p>
            Trenutno <strong>ne koristimo</strong> Google Analytics, Meta Pixel ni druge alate
            za praćenje posjetitelja. Ako to u budućnosti promijenimo, ažurirat ćemo ovu stranicu
            i, gdje je to zakonski obvezno, tražiti vaš pristanak.
          </p>

          <h2>Kolačići trećih strana</h2>
          <p>
            Ako event sadrži ugrađeni sadržaj (npr. Google karta za lokaciju), taj pružatelj
            usluge može postaviti vlastite kolačiće. Na te kolačiće nemamo utjecaj; savjetujemo
            da pregledate politiku privatnosti tih pružatelja.
          </p>

          <h2>Kako upravljati kolačićima</h2>
          <p>
            Kolačiće možete blokirati ili izbrisati u postavkama preglednika:
          </p>
          <ul>
            <li>
              <strong>Chrome</strong>: Postavke → Privatnost i sigurnost → Kolačići i drugi podaci
              stranica
            </li>
            <li>
              <strong>Firefox</strong>: Opcije → Privatnost i sigurnost → Kolačići i podaci stranica
            </li>
            <li>
              <strong>Safari</strong>: Preference → Privatnost → Upravljanje podacima web stranica
            </li>
          </ul>
          <p>
            Blokiranje nužnih kolačića onemogućit će prijavu na organizatorski račun, dok
            pregledavanje javnih događaja ostaje dostupno bez kolačića.
          </p>

          <h2>Kontakt</h2>
          <p>
            Za pitanja o kolačićima kontaktirajte nas na{" "}
            <a href="mailto:info@manifestacije.hr">info@manifestacije.hr</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
