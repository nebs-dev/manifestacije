import type { Metadata } from "next"
import { SiteHeader } from "@/components/public/site-header"
import { SiteFooter } from "@/components/public/site-footer"

export const metadata: Metadata = {
  title: "Uvjeti korištenja — Manifestacije",
  description: "Pravila objave događaja, odgovornost organizatora i uvjeti korištenja platforme Manifestacije.hr.",
}

export default function UvjetiKoristenjaPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">Uvjeti korištenja</h1>
        <p className="mt-2 text-sm text-muted-foreground">Zadnja izmjena: 1. srpnja 2026.</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">

          <h2>1. O platformi</h2>
          <p>
            Manifestacije.hr je informativni imenik kulturnih, sportskih i zabavnih događanja u
            Hrvatskoj. Platforma prikazuje događaje koje prikuplja iz javnih izvora ili koje
            organizatori sami objave. Korištenjem platforme prihvaćate ove Uvjete.
          </p>

          <h2>2. Tko može objaviti događaj</h2>
          <p>
            Događaje mogu predložiti organizatori (pravne ili fizičke osobe) koji se registriraju
            na platformi. Platforma zadržava pravo odobravanja, odbijanja ili uklanjanja svakog
            sadržaja bez obrazloženja.
          </p>

          <h2>3. Pravila objave događaja</h2>
          <p>Organizator jamči da objavljeni sadržaj:</p>
          <ul>
            <li>točno opisuje stvarni događaj koji će se održati;</li>
            <li>ne sadrži lažne, obmanjujuće ili uvredljive informacije;</li>
            <li>ne krši autorska prava trećih strana (slike, tekstovi, logotipi);</li>
            <li>nije reklama za ilegalne aktivnosti;</li>
            <li>sadrži ispravne podatke o datumu, lokaciji i pristupačnosti.</li>
          </ul>

          <h2>4. Odgovornost organizatora</h2>
          <p>
            Organizator je isključivo odgovoran za točnost svih objavljenih informacija —
            datuma, lokacije, cijena ulaznica i sadržaja programa. Manifestacije.hr nije
            organizator niti suorganizator nijednog prikazanog događaja i ne odgovara za
            eventualne izmjene, otkazivanja ni štete nastale posjetiteljima.
          </p>

          <h2>5. Moderacija i uklanjanje sadržaja</h2>
          <p>
            Zadržavamo pravo da bez prethodne najave:
          </p>
          <ul>
            <li>odbijemo ili uklonimo bilo koji događaj koji krši ova Pravila;</li>
            <li>suspendiramo ili trajno ugasimo korisnički račun organizatora u slučaju zlouporabe;</li>
            <li>ispravimo tehničke pogreške u podatkovnim zapisima.</li>
          </ul>
          <p>
            Prigovor na moderacijsku odluku možete uputiti na{" "}
            <a href="mailto:info@manifestacije.hr">info@manifestacije.hr</a>.
          </p>

          <h2>6. Intelektualno vlasništvo</h2>
          <p>
            Dizajn, kod i sadržaj platforme (osim sadržaja koji su objavili organizatori)
            vlasništvo su Manifestacije.hr. Slike događaja koje organizatori učitaju moraju biti
            slobodne za javnu objavu — organizator odgovara za posjedovanje potrebnih prava.
          </p>
          <p>
            Objavljujući sadržaj na platformi organizator nam daje neisključivu, besplatnu
            licenciju za prikaz tog sadržaja u sklopu usluge.
          </p>

          <h2>7. Vanjske poveznice i izvori</h2>
          <p>
            Platforma može sadržavati poveznice na web stranice trećih strana (organizatori,
            prodaja ulaznica). Ne odgovaramo za sadržaj tih stranica.
          </p>

          <h2>8. Ograničenje odgovornosti</h2>
          <p>
            Platforma se pruža „kakva jest” bez jamstava dostupnosti ili točnosti. Ne
            odgovaramo za izravne ni neizravne štete nastale korištenjem ili nemogućnošću
            korištenja platforme, uz iznimku šteta prouzročenih našom namjernom krivnjom ili
            grubim nemarom.
          </p>

          <h2>9. Primjenjivo pravo</h2>
          <p>
            Na ove Uvjete primjenjuje se pravo Republike Hrvatske. Za sporove je nadležan
            stvarno nadležni sud u Republici Hrvatskoj.
          </p>

          <h2>10. Izmjene uvjeta</h2>
          <p>
            Uvjete možemo mijenjati objavom nove verzije na ovoj stranici. Nastavljate li
            koristiti platformu nakon objave izmjena, smatra se da ste ih prihvatili.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
