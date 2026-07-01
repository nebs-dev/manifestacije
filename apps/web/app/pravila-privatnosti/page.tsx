import type { Metadata } from "next"
import { SiteHeader } from "@/components/public/site-header"
import { SiteFooter } from "@/components/public/site-footer"

export const metadata: Metadata = {
  title: "Politika privatnosti — Manifestacije",
  description: "Kako Manifestacije.hr obrađuje i štiti vaše osobne podatke.",
}

export default function PravilaPrivatnostiPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">Politika privatnosti</h1>
        <p className="mt-2 text-sm text-muted-foreground">Zadnja izmjena: 1. srpnja 2026.</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">

          <h2>1. Voditelj obrade</h2>
          <p>
            Voditelj obrade osobnih podataka je Nebojša Stojanović, vlasnik platforme
            Manifestacije.hr (dalje: „mi”, „nas” ili „Platforma”). Za sva pitanja vezana uz
            privatnost obratite nam se na:{" "}
            <a href="mailto:info@manifestacije.hr">info@manifestacije.hr</a>.
          </p>

          <h2>2. Koje podatke prikupljamo</h2>

          <h3>a) Posjetitelji</h3>
          <p>
            Posjetitelji koji pregledavaju događaje ne moraju stvarati račun niti davati osobne
            podatke. Naši poslužitelji automatski bilježe standardne tehničke podatke: IP adresu,
            vrstu preglednika, datum i vrijeme pristupa, te URL stranice — isključivo u svrhu
            sigurnosti i dijagnostike tehničkih problema. Ti se zapisi brišu nakon 30 dana.
          </p>

          <h3>b) Organizatori događaja</h3>
          <p>
            Organizatori koji se registriraju za objavu događaja daju nam: ime i prezime ili naziv
            organizacije, e-mail adresu i lozinku (čuva se u kriptiranom obliku). Objavljeni
            događaji mogu sadržavati kontaktne podatke organizatora koje on sam unese (npr.
            telefon, web stranica).
          </p>

          <h3>c) Podneseni događaji</h3>
          <p>
            Ako pošaljete prijedlog događaja putem obrasca, prikupljamo sadržaj samog obrasca
            (naziv, opis, datum, lokacija). Ove podatke koristimo isključivo za moderaciju i
            eventualno objavljivanje događaja.
          </p>

          <h2>3. Svrha i pravna osnova obrade</h2>
          <table>
            <thead>
              <tr>
                <th>Svrha</th>
                <th>Pravna osnova (GDPR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Prikaz i pretraga događaja</td>
                <td>Legitimni interes (čl. 6. st. 1. f)</td>
              </tr>
              <tr>
                <td>Upravljanje računom organizatora</td>
                <td>Izvršenje ugovora (čl. 6. st. 1. b)</td>
              </tr>
              <tr>
                <td>Sigurnost i dijagnostika</td>
                <td>Legitimni interes (čl. 6. st. 1. f)</td>
              </tr>
            </tbody>
          </table>

          <h2>4. Dijeljenje podataka s trećim stranama</h2>
          <p>
            Vaše osobne podatke ne prodajemo niti ustupamo trećim stranama za marketinške svrhe.
            Podatke možemo dijeliti s:
          </p>
          <ul>
            <li>
              <strong>Pružatelji tehničkih usluga</strong> — hosting, baze podataka i pohrana
              datoteka (npr. Railway, Cloudinary). Svi obrađuju podatke samo po našim uputama i
              vezani su ugovorom o obradi podataka.
            </li>
            <li>
              <strong>Nadležna tijela</strong> — jedino ako to zahtijeva zakon ili rješenje suda.
            </li>
          </ul>

          <h2>5. Kolačići (cookies)</h2>
          <p>
            Platforma koristi isključivo tehničke kolačiće nužne za funkcioniranje (npr. sesija
            prijavljenog organizatora). Trenutno ne koristimo kolačiće za praćenje ni oglašavanje.
            Više informacija u{" "}
            <a href="/kolacici">Obavijesti o kolačićima</a>.
          </p>

          <h2>6. Pohrana i brisanje podataka</h2>
          <ul>
            <li>Tehnički zapisi poslužitelja: 30 dana.</li>
            <li>Podaci računa organizatora: čuvaju se dok je račun aktivan. Na zahtjev brišemo račun i sve vezane osobne podatke u roku od 30 dana.</li>
            <li>Objavljeni događaji mogu ostati vidljivi kao arhiva kulturnih zbivanja i nakon brisanja računa, ali bez osobnih podataka autora.</li>
          </ul>

          <h2>7. Vaša prava</h2>
          <p>Sukladno GDPR-u imate pravo:</p>
          <ul>
            <li>pristupa vašim osobnim podacima;</li>
            <li>ispravka netočnih podataka;</li>
            <li>brisanja podataka („pravo na zaborav”);</li>
            <li>ograničenja obrade;</li>
            <li>prigovora na obradu;</li>
            <li>prenosivosti podataka.</li>
          </ul>
          <p>
            Zahtjev pošaljite na{" "}
            <a href="mailto:info@manifestacije.hr">info@manifestacije.hr</a>. Odgovaramo u roku od
            30 dana. Imate i pravo podnijeti pritužbu Agenciji za zaštitu osobnih podataka (
            <a href="https://azop.hr" target="_blank" rel="noopener noreferrer">azop.hr</a>).
          </p>

          <h2>8. Izmjene politike</h2>
          <p>
            Politiku možemo povremeno ažurirati. O značajnim izmjenama obavijestit ćemo
            organizatore e-mailom. Datum zadnje izmjene uvijek je vidljiv na vrhu ove stranice.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
