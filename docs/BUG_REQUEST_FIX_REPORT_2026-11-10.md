# Bug & Request — izvještaj o obradi (10. 11. 2026.)

**Izvor:** `docs/Bug & Request.pdf` (8 stranica, Vanesin dokument) i postojeći backlog
`docs/Manifestacije_Bug_Request_Backlog.md`.
**Način rada:** svaka promjena na zasebnoj grani → testovi → merge u `main` → push →
provjera na produkciji prije sljedeće stavke.

---

## 1. Napravljeno u ovom prolazu

### 1.1 Tipka „Vrati" za ignoriranog kandidata (str. 1)

**Problem:** kartica „Ignorirani" nije imala povratak. Rukovatelj `unignore` je postojao u
kodu, ali se nikad nije prikazao, a API nije imao `undo` — jedini povratak bio je ponovno
parsiranje cijelog izvora.

**Promjena:**
- `IgnoreCandidateDto` prima `undo`; `AdminService.ignoreCandidate` vraća kandidata u
  `pending`, a izvor u `PARSED`. Kandidat koji već ima kreiran događaj i dalje se odbija.
- Red u tablici ignoriranih ima gumb **Vrati** sa stanjem učitavanja i stvarnom porukom
  greške umjesto dotadašnjeg nadomjesnog teksta.

**Dokaz:** `apps/api/test/admin.service.spec.ts` („restores an ignored candidate to pending
when undo is requested"), cijeli API paket zelen.
**Produkcija:** novi string `Vraćanje…` prisutan u objavljenom chunku
`app/admin/sources/[id]`; API ponovno deployan (uptime resetiran).
**Commit:** `276dc1a8`

### 1.2 Popravak testne okoline (preduvjet za ostalo)

**Problem:** 46 web testova padalo je na `main` prije bilo kakve moje promjene —
`Cannot read properties of undefined (reading 'removeItem')`. Node 26 ima ugrađeni
`localStorage` koji je bez `--localstorage-file` `undefined`, a postoji prije nego Vitest
podigne jsdom, pa jsdomov `localStorage` nikad ne dođe na globalni objekt. Uz to je
globalni `sessionStorage` odbijan kao `storageArea` u `StorageEvent`.

**Promjena:** `apps/web/vitest.setup.ts` uzima oba spremnika iz same-origin iframea
(pravi jsdom `Storage` objekti, rade i nakon uklanjanja iframea).

**Dokaz:** web paket 488 → **534 prolaza, 0 padova**.
**Commit:** `b7bb2562`

### 1.3 Datumi koje parser nije prihvaćao (str. 1, 2, 3)

Ovo je uzrok prijava „doda crvenu oznaku datuma, ali ne unese", „dodala sam sliku i on ne
doda datume" i „screenshot ne prepozna dobro vrijeme".

**Problem:** provjera dokaza tražila je da izvor sadrži **točno jedan** datum i **točno
jedno** vrijeme, inače je polje ostajalo prazno uz upozorenje. Poster s rasponom
(„17:30 – 19:00", „13.–29. studenoga") time je gubio cijeli termin. Osim toga, čitač dokaza
nije poznavao raspone, kose crte ni kratice mjeseci.

**Promjena:**
- Čitanje dokaza pokriva raspone s dijeljenim mjesecom (`13.-29. studenoga`, `3.-4.7.`,
  `12.10.-13.10.2027.` — godina s kraja datira i prvi dan), `13/11/2026`, `13-11-2026` i
  kratice (`13. stu. 2026.`). Dan bez godine zadržava pretpostavku samo ako isti dan nije
  drugdje u tekstu datiran.
- LLM put više ne traži jedinstvenost: vrijednost koju je model odabrao mora biti jedna od
  onih koje izvor navodi. Ako ih izvor navodi više, unos prolazi s odabranom vrijednošću i
  upozorenjem koje izvor šalje na pregled (`NEEDS_REVIEW`).
- Prijave organizatora idu na pregled po istim upozorenjima kao i admin unos, a ne samo
  kad polje nedostaje.

**Dokaz:** `apps/api/test/event-parsing-dates.spec.ts` (novi testovi za raspone, kratice,
kose crte i regresija s rasporedom „17:30 – 19:00" iz dokumenta),
`apps/api/test/ai-poster-flow.spec.ts`; cijeli API paket zelen.
**Commits:** `03c135ce`, `9fe926a7`

### 1.4 Pregled neobjavljenog događaja iz admina (str. 5)

**Problem:** „Otvori javnu stranicu" postojalo je samo za objavljene događaje, a traženo je
„da vidim post kad god želim iz admina".

**Promjena:** uz svaki događaj bez javne stranice stoji **Pregledaj skicu**. Gumb traži od
API-ja potpisanu poveznicu koja vrijedi 30 minuta i imenuje točno taj događaj; javna
stranica tada prikazuje događaj bez obzira na status, bez keširanja, s trakom „Pregled za
uredništvo" i `noindex`.

**Sigurnost:** token nosi `scope` i nema identitet korisnika; `JwtAuthGuard` od sada odbija
svaki token sa `scope` claimom, pa takva poveznica ne može poslužiti kao sesija. Pokriveno
testovima (tuđi slug, drugi ključ, istekao token, pokušaj prijave preview tokenom).

**Dokaz:** `apps/api/test/event-preview.spec.ts`,
`apps/web/src/components/admin/admin-productivity.test.tsx`; API 751 test, web 535 testova,
`next build` prolazi.
**Commit:** `dfb1bd97`

---

## 2. Provjereno — već radi, nije trebalo dirati

| Stavka iz dokumenta | Nalaz |
|---|---|
| Rich-text uređivanje opisa (bold, kurziv, link, liste) | `rich-text-editor.tsx`, u admin i organizer uređivaču |
| Brisanje završnog vremena bez brisanja ostalog | riješeno ranije (`62759b51`) |
| Više screenshotova po izvoru + naknadna dopuna | `ScreenshotsPicker` (do 4), „Dopuni i ponovno parsiraj", „Dopuni podatke pomoću AI" |
| Uređivanje „Besplatno / Naplata" izravno u listi | kolona `isFree` u admin tablici |
| Upozorenje na duplikate pri unosu | zajednička provjera prije spremanja (admin, organizer, kandidati) |
| Pretraga organizatora | polje „Pretraži organizatore po nazivu" |
| Tko je unio koji događaj i koliko | kolona „Uneseno događaja" + izvještaj po autoru i razdoblju |
| Notifikacije + „Označi sve kao pročitano" | `notifications-page.tsx` |
| „Organizer portal" preimenovan | produkcija: „Prostor za organizatore" |
| Pomoć na ekranima prijave | produkcija: „Trebate pomoć? Pišite na info@manifestacije.hr" |
| „Kaže petak, a danas je subota" | vikend raspon računa se po zagrebačkom danu; prošli dan dobiva oznaku „Još traje" i prikazuje samo događaje koji stvarno još traju. Danas (utorak) stranica ispravno nudi vikend 13.–15. 11. |
| Događaj do 02:00 prikazan kao „višednevni" | `event-end.ts` (`isOvernightEvent`) + testovi |
| Višednevni iza aktualnih | provjereno na `/eventi`: prve kartice su jednodnevni termini |
| „Prošli događaji" | `/prosli-dogadaji` radi (HTTP 200) |
| Povratak s događaja na kalendar | `calendar-return.ts` + testovi |
| Krivi logo u Google rezultatu | **nije kod** — Google trenutno servira ispravan logo (provjereno kroz Googleov favicon servis); svi iconi na stranici su bajt-identični. Ako se i dalje vidi stari, to je predmemorija preglednika ili Googleovo staro snimanje |
| GA4 „ne vidi se koji je obrazac" | **nije kod** — svi javni obrasci imaju `id` (`home-hero-search-form`, `site-header-search-form-desktop/mobile`, `event-filters-search-form`, `organizer-*`), provjereno u HTML-u produkcije. U GA4 treba dodati dimenziju `form_id` (vidi 4.) |

---

## 3. Otvoreno

| Stavka | Status | Zašto |
|---|---|---|
| Upload godišnjeg/mjesečnog plana kao PDF/DOC (EVT-01) | **odgođeno (tvoja odluka, 10. 11. 2026.)** | organizatori i dalje šalju screenshotove (do 4 odjednom) |
| Prijava `schleis` / `hoochy` / `schleisv@gmail` (AUTH-01) | **preskočeno (tvoja odluka)** | traži podatke iz produkcije; kod prijave i resetiranja je ispravan (normalizacija emaila, poruka za nepreuzeti profil, admin može postaviti lozinku na Organizatori → Resetiraj lozinku) |
| „Na mobitelu karta izgleda čudno" | treba tvoja potvrda | prethodno provjereno na 390/360 px u listopadu; ako i dalje izgleda krivo, treba screenshot s uređaja i modelom |

---

## 4. Što ti trebaš napraviti

1. **Admin → Izvori → bilo koji izvor → kartica „Ignorirani"**: klikni **Vrati** na jednom
   kandidatu i potvrdi da se vraća na „Na čekanju". (API je deployan; ovo je jedina stvar
   koju ne mogu kliknuti umjesto tebe jer traži prijavu.)
2. **Admin → Događaji**: kod događaja koji nije objavljen klikni **Pregledaj skicu** —
   otvara se javna stranica s trakom „Pregled za uredništvo".
3. **GA4**: u izvještaju `form_submit` dodaj sekundarnu dimenziju **Form ID** (ili napravi
   exploration: Event name = `form_submit`, dimenzija `form_id`). Tada se vidi koji obrazac
   generira unose.
4. **Search Console** (neobavezno): ako želiš požuriti osvježavanje prikaza u Googleu,
   pošalji naslovnicu na ponovno indeksiranje.

---

## 5. Commitovi

| Commit | Opis |
|---|---|
| `276dc1a8` | feat(admin): restore an ignored parsed candidate |
| `b7bb2562` | test(web): restore Web Storage in the jsdom test environment |
| `03c135ce` | fix(parser): keep dates a poster states as a range or in shorthand |
| `9fe926a7` | test(parser): cover the reported sign-up poster schedule |
| `dfb1bd97` | feat(admin): preview an unpublished event on its real public page |

Svaki je razvijen na vlastitoj grani i spojen u `main` s `--no-ff`.
