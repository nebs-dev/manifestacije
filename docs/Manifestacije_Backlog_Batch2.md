# Manifestacije.hr — Bug & Request batch 2: triage prema kodu

**Izvor:** Vanesin drugi set zahtjeva (statistika unosa, parsiranje datuma s plakata, memorija lokacija, masovna obrada plakata, „Izdvojeno" u pregledu parsirane objave).
**Datum triage-a:** 2026-11-25. Branch: `feat/automated-code-review`.
**Što ovaj dokument jest:** kategorizacija zahtjeva + status u **kodu** s dokazima (putanja:linija). **Nije** potvrda stanja produkcije i **nije** plan implementacije. Nijedna linija koda nije mijenjana.

**Legenda:** `BUG` = neispravan tok; `UX`; `FEATURE`; `DECISION` = treba produktna odluka; `INVESTIGATE` = treba runtime dokaz.
Prioritet: `P0` blokira osnovnu funkciju, `P1` visoko, `P2` srednje, `P3` kasnije. Effort: `S` < 0.5 dana, `M` 1–3 dana, `L` > 3 dana / više PR-ova.
Status: `NOT IMPLEMENTED`, `PARTIAL`, `DONE`, `BUG POTVRĐEN U KODU`, `UNKNOWN / NEEDS RUNTIME`.

---

## Sažetak za odluku

| # | Zahtjev | Status | Effort | Prioritet |
|---|---|---|---|---|
| 1 | Statistika unosa (dashboard) | **GOTOVO** — `/admin/entry-statistics`, faza 1 + trendovi, statistika sadržaja i CSV izvoz | L | P2 |
| 2 | Datum/vrijeme s plakata nije popunjen | **RIJEŠENO** — engleski mjeseci + am/pm, 16 novih testova | S–M | **P1** |
| 3 | Memorija mjesta i adresa | **RIJEŠENO** (VEN-01…06, uključujući spajanje duplikata na `/admin/venues`) | M | P1 |
| 4 | Masovna obrada plakata + web istraživanje | **BULK-01 RIJEŠEN** (`/admin/masovni-unos`); web pretraga (BULK-02) odgođena odlukom | L | P3 |
| 5 | „Izdvojeno" u pregledu parsirane objave | **RIJEŠENO** — plumbing + switch + 5 testova | S | P2 |

**Najbolji prvi potez:** #5 (S, polje već u DTO-u), pa #2 (jedini pravi bug), pa #3. #1 u fazama. #4 zadnje — to je novi sustav, ne nadogradnja parsera.

---

## 1 — Statistika unosa (novi dashboard)

**ID:** STAT-01…STAT-09 · **Vrsta:** FEATURE · **Prioritet:** P2 · **Status:** FAZA 1 GOTOVA 2026-11-25

**Isporučeno:** `/admin/statistika` (`apps/web/app/admin/statistika/page.tsx`, `entry-stats-page.tsx`), API `GET /api/admin/stats/entries` i `/stats/entries/day` (`apps/api/src/admin/entry-stats.ts` — čiste funkcije, `admin.service.ts` — upiti). Kartice, 10 brzih razdoblja + strelice po mjesecima + prilagođeno razdoblje, tablica administratora (aktivni dani, prosjek/dan, udio, zadnji unos), organizatori odvojeno, skriveni neaktivni računi, dnevna matrica sa zbrojevima, heatmap kalendar, kronologija dana sa sekundama, razmaci (prosjek/medijan/min/max/raspon) i odbacivanje pauza >15/30/60 min, klik s brojke na filtrirani popis događaja.
**Odluke u kodu:** grupiranje po Zagreb danu (ne UTC), tjedan počinje ponedjeljkom, tekući mjesec staje na danas, usporedba = jednak broj dana neposredno prije razdoblja, e-mail adrese se ne vraćaju ni ne prikazuju, nepoznat autor se prikazuje zasebno.
**Dokaz:** 44 Jest testa (`entry-stats.spec.ts`, `admin-entry-stats.spec.ts`) + 32 Vitest testa (`entry-stats.test.ts`, `entry-stats-page.test.tsx`).
**Faza 2 isporučena 2026-11-25:** trendovi po mjesecima, godinama, danima u tjednu i satima; usporedba tekućeg mjeseca s istim brojem dana prethodnog; statistika sadržaja (gradovi, županije, kategorije, objavljeno/neobjavljeno, nadolazeći, uneseno na dan održavanja, vrijeme najave kao medijan i prosjek, neriješeni duplikati, nepotpun sadržaj s popisom); izvoz u CSV za hrvatski Excel (`;`, decimalni zarez, BOM, zaštita od formula u ćelijama).

**Otvoreno:** automatsko generiranje mjesečnog izvještaja (točka 11), evidencija uređivanja (nema povijesti izmjena — vidi odluku 2).

**Prethodni nalaz (zadržan radi konteksta):** PARTIAL

### Što već postoji (dokazi)

| Komad | Gdje |
|---|---|
| `Event.createdByUserId` + relacija `createdBy` | `apps/api/prisma/schema.prisma:318-319` |
| Filter po autoru i datumu unosa (`createdByUserId`, `createdFrom`, `createdTo`) | `apps/api/src/admin/admin.controller.ts:34-57` |
| Agregacija po autoru (`groupBy createdByUserId`) + admin/organizer zbrojevi | `apps/api/src/admin/admin.service.ts:480-497` (`eventCreatorReport`) |
| Tablica autora u UI-u, unutar stranice Događaji | `apps/web/src/components/admin/event-creator-report.tsx` (64 linije), endpoint `/api/admin/events/creator-report` |
| Admin sidebar za novu rubriku | `apps/web/src/components/admin/admin-sidebar.tsx` |
| Zagreb timezone helperi | `apps/api/src/common/zagreb-time.ts` (`zagrebDateKey`) |

Dakle: **podaci i jedna agregacija postoje**, nema zasebne stranice, kartica, brzih razdoblja, dnevne matrice, heatmapa ni kronologije.

### Po točkama zahtjeva

| ID | Točka zahtjeva | Status | Napomena / effort |
|---|---|---|---|
| STAT-01 | Zasebna rubrika „Statistika unosa" | NOT IMPLEMENTED | Nova ruta `apps/web/app/admin/statistika/`, sidebar stavka. S |
| STAT-02 | Sažete kartice (ukupno, admin, organizator, danas, jučer, tjedan, mjesec, prosjek, usporedba) | NOT IMPLEMENTED | Jedan novi endpoint umjesto 9 upita. `eventCreatorReport` već daje `total`/`adminCount`/`organizerCount`. M |
| STAT-03 | Brzi odabir razdoblja + strelice mjesec | NOT IMPLEMENTED | Postojeći `createdFrom`/`createdTo` su dovoljan API; sve je front-end. Granice računati u `Europe/Zagreb`, ne `new Date()` lokalno. S–M |
| STAT-04 | Pregled po administratorima (aktivni dani, prosjek/dan, zadnji unos, % udjela) | PARTIAL | `eventCreatorReport` daje samo `count` po useru. Aktivni dani i zadnji unos = novi `groupBy` po danu. M |
| STAT-05 | Dnevna matrica (dan × administrator, svi dani mjeseca, zbrojevi) | NOT IMPLEMENTED | Jedan `groupBy [createdByUserId]` po danu u Zagrebu; Prisma ne grupira po danu → raw SQL s `AT TIME ZONE 'Europe/Zagreb'`. M |
| STAT-06 | Kalendar heatmap | NOT IMPLEMENTED | Isti podatak kao STAT-05, drugi prikaz. S nakon STAT-05. |
| STAT-07 | Kronologija unosa + razmaci (medijan, min/max, po satu, odbacivanje pauza >15/30/60 min) | NOT IMPLEMENTED | Podatak postoji (`Event.createdAt` je `@default(now())`). Logika razmaka je čista funkcija → TDD po `CLAUDE.md`. M |
| STAT-08 | Mjesečna/godišnja statistika, trendovi, dan u tjednu, sat u danu | NOT IMPLEMENTED | Faza 2. M |
| STAT-09 | Statistika sadržaja (gradovi, županije, kategorije, objavljeno/neobjavljeno, nadolazeći, duplikati, nepotpuni, uređeni, obrisani) | PARTIAL / **BLOKIRANO** | Gradovi/županije/kategorije/status: izvedivo iz `Event` + `EventCategory`. Duplikati: `EventDuplicateCandidate` (`schema.prisma:548`). **„Naknadno uređeni i obrisani" nije izvedivo — vidi STAT-RISK-01.** M + ovisi o odluci |

### STAT-RISK-01 — audit trail ne postoji za admina (**DECISION, P1 za ovaj zahtjev**)

Točka 12 traži da se „kreiranje, uređivanje, objavljivanje i brisanje evidentiraju kao odvojene aktivnosti". U kodu danas:

- **kreiranje** → `Event.createdAt` + `createdByUserId` (dostupno),
- **objavljivanje** → samo `Event.publishedAt` (`schema.prisma:348`); **ne zna se tko je objavio**,
- **uređivanje** → samo `Event.updatedAt` (zadnja izmjena, bez autora i bez povijesti). `EventRevision` (`schema.prisma:371-399`) je **isključivo organizatorski** tok — `organizerId` je obavezan, admin edit ne stvara reviziju,
- **brisanje** → brisanje je hard delete, red nestaje; nema `deletedAt` ni logа.

Posljedica: metrike „naknadno uređenih i obrisanih događaja" i „tko je objavio" **nije moguće prikazati za prošlost ni s kakvim upitom** — podatak nije zabilježen. Dvije opcije:

1. uvesti `EventActivity` tablicu (eventId, userId, kind CREATE/UPDATE/PUBLISH/DELETE, createdAt, diff) i mjeriti **od dana uvođenja**, povijest jasno označiti kao nepoznatu (što točka 12 i dopušta),
2. izbaciti te dvije metrike iz faze 1.

Dok se ne odluči, ne obećavati te brojke u UI-u.

### STAT-RISK-02 — kvaliteta povijesnih podataka (**INVESTIGATE, P2**)

`createdByUserId` je `Int?` s `onDelete: SetNull` (`schema.prisma:319`) i `eventCreatorReport` već ima `unknownCount` za `null` (`admin.service.ts:493`). Prije objave brojki treba runtime provjera na produkciji: koliko događaja ima `createdByUserId = NULL`, i koliko ih je `sourceType` ≠ `MANUAL` (automatske discovery unose ne smije se pripisati osobi). Enum `EventSourceKind` (`schema.prisma:51`) je ono što razlikuje ručne od automatskih unosa — točka 12 to izričito traži.

### STAT-RISK-03 — autorizacija i e-mail adrese

Zahtjev kaže „pristup isključivo ovlaštenim korisnicima" i „ne prikazivati e-mail adrese". Današnji `creator-report` **vraća `email`** (`admin.service.ts:487`, `event-creator-report.tsx:7` i `label()` koji ga ispisuje). Novi endpoint ne smije vraćati e-mail. Admin guard postoji na `/api/admin/*` — novu rutu treba pokriti istim guardom i E2E provjerom da organizator ne može doći do nje.

---

## 2 — Datum i vrijeme s plakata nisu popunjeni (BOOK AND MUSIC 1)

**ID:** PARSE-01 · **Vrsta:** BUG · **Prioritet:** P1 · **Status:** RIJEŠENO 2026-11-25 · **Effort:** S–M

**Fix:** `englishMonths` + `englishDayFirst`/`englishMonthFirst` (oba poretka, jer je abecedni mjesec nedvosmislen) i `meridiem` regex u `apps/api/src/ai-parser/date-evidence.ts`. 12-satno vrijeme se rješava **prije** 24-satnog i briše iz teksta — inače bi `11.30pm` dalo i pogrešno `11:30`. Brojčani slash (`11/12`) **nije** dirani, da se ne uvede US/EU dvosmislenost.
**Dokaz:** 16 novih testova u `apps/api/test/event-parsing-dates.spec.ts` (uključujući guard da `THURSDAY`, `march of the penguins 2026` ne daju datum) + HTTP test cijelog toka s tekstom tog plakata u `apps/api/test/ai-poster-flow.spec.ts` (admin i organizer put). Cijeli API paket: 876 prošlo, 0 palo.

### Uzrok (dokazano, ne pretpostavka)

Parser prihvaća model­ov datum samo ako ga **vlastiti regex nađe u citatu izvora** — `normalizeStart` u `apps/api/src/ai-parser/ai-event-parser.service.ts:779-816`: ako `sourceDates(evidence.dateText)` i `sourceTimes(evidence.timeText)` ne vrate vrijednost, polje se **briše** (`return ""`) i dodaje se upravo ona poruka iz prijave (linija 802).

Oba citata s tog plakata su nevidljiva trenutnim regexima u `apps/api/src/ai-parser/date-evidence.ts`:

1. **`12/NOV/2026`** — `slashed` regex (`date-evidence.ts:27`) traži `\d{1,2}/\d{1,2}/20\d{2}`, tj. **mjesec kao broj**. Mjesečni rječnici (`months`, `shortMonths`, linije 3-16) sadrže **samo hrvatske** nazive — `nov` nije ni u jednom (hrvatski je `stu`/`studeni`).
2. **`start 5 pm`** — `sourceTimes` (`date-evidence.ts:102-116`) prihvaća `17:00`, `17.00`, `17 h`, `17 sati`, ali **nema am/pm granu**, pa `5 pm` ne daje ništa.

Provjereno izvođenjem helpera (`apps/api/dist/ai-parser/date-evidence.js`, build 2026-11-18, noviji od `src` 2026-11-10):

```
"THURSDAY | 12/NOV/2026" → dates=[] times=[]
"start 5 pm"             → dates=[] times=[]
"12. studenoga 2026."    → dates=['2026-11-12']
"17 h"                   → times=['17:00']
```

Model je dakle ispravno pročitao plakat; **gate ga je odbio**, i to je po dizajnu („the quote decides", komentar na liniji 786-792) — gate samo ne poznaje engleski zapis.

### Što treba (bez implementacije sada)

- failing test prvo, u `apps/api/test/event-parsing-dates.spec.ts` (ta datoteka već testira ovu poruku) — `sourceDates("12/NOV/2026")` i `sourceTimes("start 5 pm")`;
- engleski mjeseci (puni + trobukvični) i slash-oblik s abecednim mjesecom; pažljivo s `MAR`/`MAJ` i s danima u tjednu (`THURSDAY` ne smije ništa dati);
- am/pm: `5 pm → 17:00`, `12 am → 00:00`, `12 pm → 12:00`. Pazi na koliziju s `sourceTimes` maskiranjem datuma;
- **dvosmislenost `12/NOV` vs `11/12`**: ako se doda i brojčani slash s mjesecom prvim (US zapis), to je nova klasa pogrešnih datuma. Preporuka: **ne** dirati brojčani slash, samo abecedni mjesec.
- Po `CLAUDE.md` („Report parsers … only proven on a real screenshot"): dokaz = stvarni upload tog plakata kroz admin UI, ne samo unit test na tekstu.

### PARSE-02 (srodno, INVESTIGATE, P2)

`literal()` (`ai-event-parser.service.ts:783`) za screenshotove **preskače** provjeru „je li citat doslovno u tekstu" (`isScreenshot ||`), pa za plakate ostaje samo regex provjera. Vrijedi provjeriti koliko plakata pada na istoj liniji 802 u produkciji prije širenja regexa — brojka odlučuje je li ovo P1 za jedan plakat ili sistemski.

---

## 3 — Memorija mjesta održavanja i adresa

**ID:** VEN-01…VEN-06 · **Vrsta:** FEATURE/UX · **Prioritet:** P1 · **Status:** VEN-01…05 RIJEŠENO 2026-11-25, VEN-06 otvoren · **Effort:** M

**Isporučeno:** `searchVenues` vraća `name`/`address`/`cityName`/`cityId`/`lat`/`lng` odvojeno, traži case-insensitive, zadržava mjesta bez koordinata i **rangira po gradu događaja bez filtriranja** (VEN-05); novi `VenueNameInput` autocomplete na polju naziva mjesta u pregledu kandidata i u uređivanju događaja; odabir mjesta popunjava adresu, grad i koordinate; kad plakat navede samo naziv kluba, adresa se automatski popuni **samo ako je podudaranje jednoznačno**, uz vidljivu napomenu.
**Dokaz:** 8 Jest testova (`venue-suggestions.spec.ts`, uključujući dokaz da `createFromDto` ponovno koristi spremljenu adresu i koordinate i da ih novi događaj bez adrese ne briše) + 10 Vitest testova (`venue-name-input.test.tsx`, `parsed-candidate-venue.test.tsx`).

### Što već postoji

| Komad | Gdje |
|---|---|
| `Venue` model: `name`, `slug`, `address`, `cityId`, `lat`, `lng`, `@@unique([slug, cityId])` | `apps/api/prisma/schema.prisma:256-271` |
| Venue se **automatski stvara/pronalazi** iz `venueName` + grada pri kreiranju i uređivanju događaja (`connectOrCreate`) | `apps/api/src/events/events.service.ts:36-43`, `163-172` |
| Autocomplete endpoint `GET /api/admin/venues/search?q=` (naziv **ili** adresa, `include city`, `take 5`) | `apps/api/src/admin/admin.controller.ts:171`, `admin.service.ts:1380-1399` |
| Autocomplete već u UI-u — u polju **„Precizna lokacija (koordinate)"** | `parsed-candidate-card.tsx:436-447`, `event-edit-form.tsx:475` |
| Geokodiranje kao fallback | `apps/api/src/events/events.service.ts:369-382` |

Baza mjesta dakle **već postoji i već se puni** — zahtjev „izgraditi jedinstvenu bazu mjesta iz postojećih događaja" je u velikoj mjeri ispunjen.

### Što ne postoji

| ID | Zahtjev | Status | Napomena |
|---|---|---|---|
| VEN-01 | Tipkanje **naziva mjesta** predlaže spremljena mjesta | NOT IMPLEMENTED | Polje „Lokacija / venue" (`parsed-candidate-card.tsx:421-423`) je običan `Input`; autocomplete visi samo na polju koordinata. S–M |
| VEN-02 | Odabir mjesta puni adresu + grad + koordinate | PARTIAL | `searchVenues` vraća `label`, `lat`, `lng`, `cityName` — **ne vraća `name` i `address` odvojeno**, pa ih UI ne može upisati u prava polja. Potrebna izmjena response oblika (`admin.service.ts:1394-1398`). S |
| VEN-03 | Obrnuti smjer: odabir adrese predlaže naziv mjesta | NOT IMPLEMENTED | Isti endpoint pokriva i taj upit (traži po `address`), treba samo vratiti `name`. S |
| VEN-04 | Parser s plakata prepozna „Oxygene" i poveže s bazom | NOT IMPLEMENTED | Danas se `candidate.venueName` upisuje kao tekst (`admin.service.ts:1108`), bez pretrage baze pri parsiranju. M |
| VEN-05 | Nema automatskog pogrešnog povezivanja kad više gradova ima mjesto istog naziva | **BUG U NASTAJANJU** | `searchVenues` **ne filtrira po gradu** (`admin.service.ts:1381-1390`) i vraća prvih 5 po imenu. Ako VEN-04 postane automatski, ovo je izvor tihih pogrešnih adresa. `@@unique([slug, cityId])` dopušta isti naziv u više gradova — što je ispravno. Obavezno: prioritizirati grad događaja i ponuditi izbor. S (uz VEN-04) |
| VEN-06 | Potvrda/ispravak + spremanje novog mjesta | PARTIAL | `connectOrCreate` sprema bez pitanja; admin može ispraviti polja prije importa, ali nema „spremi kao novo mjesto / spoji s postojećim". Spajanje duplikata mjesta ne postoji nigdje. M |

**Dodatno ograničenje:** `searchVenues` traži `lat: { not: null }, lng: { not: null }` (`admin.service.ts:1386-1387`) — mjesta bez koordinata, iako imaju adresu, **ne pojavljuju se u prijedlozima**. To je logično za picker koordinata, ali pogrešno za prijedlog naziva/adrese. Vjerojatno su potrebna dva načina ili dva endpointa.

---

## 4 — Masovna obrada plakata + istraživanje na internetu

**ID:** BULK-01…BULK-05 · **Vrsta:** FEATURE · **Prioritet:** P3 · **Status:** NOT IMPLEMENTED · **Effort:** L

| ID | Zahtjev | Status | Dokaz / napomena |
|---|---|---|---|
| BULK-01 | Više plakata odjednom + „Obradi sve" + napredak | **RIJEŠENO 2026-11-25** — `/admin/masovni-unos`: svaki plakat je svoj izvor, red čekanja s dva plakata u obradi, napredak, zaustavljanje, ponovni pokušaj samo neuspjelih, poveznica na svaki izvor. Bez objave i bez web pretrage. Dokaz: 7 Vitest testova (`bulk-poster-upload.test.tsx`) + 5 (`run-queue.test.ts`). Ranije stanje: | Postoji upload **do 4 slike u jednom zahtjevu**, ali kao **jedan izvor** (jedan događaj ili jedan višedogađajni plakat): `ai-event-parser.service.ts:584-585` i `604` („Several posters/screenshots of the same source, read in one request (EVT-07)"), limit `MAX_SCREENSHOTS_PER_REQUEST` = 4 (`admin.dto.ts:78`, „Najviše 4 slike po zahtjevu"). **20 plakata = 20 različitih događaja** nije podržano: nema queuea po datoteci, nema prikaza napretka. Infrastruktura za poslove postoji (`IngestionJob`, `schema.prisma:562`) ali se koristi samo u `monitored-sources.service.ts`. M–L |
| BULK-02 | **AI stvarno pretražuje internet** (najvažnije) | NOT IMPLEMENTED | Nigdje u `apps/api/src` nema web-search alata — nema `web_search` server toola niti bilo kakve pretrage; jedini dolazni web je **parsiranje zadanog URL-a** (`POST /api/admin/event-sources/parse-url`, `admin.controller.ts:131`) i crawl **unaprijed definiranih** monitored sourceva. L |
| BULK-03 | Usporedba plakata i weba, dopuna polja | NOT IMPLEMENTED | Postoji „dopuna" (`supplementSource`/`supplementEvent`, `admin.service.ts:874`, `903`, do 20 dopuna) koja čuva ručno ispravljena polja — to je prava točka na koju se web-rezultat kasnije spaja. M (nakon BULK-02) |
| BULK-04 | Više događaja na jednom plakatu | **DONE** | `occurrences` + batch kandidati (`ai-event-parser.service.ts:859-876`, `admin.service.ts:1117-1136`). Zahtjev „zadržati" je zadovoljen. |
| BULK-05 | Provjera duplikata + nacrti za pregled, ništa se ne objavljuje bez potvrde | **DONE** | `EventDuplicateCandidate` (`schema.prisma:548`), `duplicates` modul, provjera prije spremanja u `parsed-candidate-card.tsx:216-227`; import ide u `PENDING_REVIEW` osim eksplicitnog `publish` (`admin.service.ts:1113`). |

### BULK-RISK-01 — SSRF i cijena (**P0 ako se BULK-02 radi**)

Web pretraga iz backenda je točno onaj tok koji `CLAUDE.md` označava kao najosjetljiviji. Svaki dohvat mora ići kroz `apps/api/src/common/ssrf.ts`, nijedan URL iz LLM izlaza ne smije se dohvatiti bez te provjere, a linkovi iz kandidata već se filtriraju `safeHttpUrlOrUndefined` (`admin.service.ts:1102`, `1108`) — isti standard vrijedi i za izvore pronađene pretragom.

Cijena: 20 plakata × (vision parse + n web pretraga + n dohvata + sinteza) je red veličine veći od današnjeg jednog poziva po plakatu. Prije implementacije treba brojka: maksimum pretraga po događaju, cache po (naziv, datum, grad), i gornja granica po batchu. Bez toga je ovo otvoreni račun.

### BULK-RISK-02 — „ne izmišljati podatke"

Zahtjev to izričito traži, a arhitektura za to već postoji i treba je **proširiti, ne zaobići**: svaka vrijednost iz weba mora nositi svoj citat i proći isti gate kao danas plakat (`normalizeStart`, `literal()`), inače se vraćamo na pogrešne datume bez upozorenja. Web izvor nije „potvrda" plakata samo zato što je s interneta.

---

## 5 — „Izdvojeno" u pregledu AI parsirane objave

**ID:** FEAT-01 · **Vrsta:** FEATURE/UX · **Prioritet:** P2 · **Status:** RIJEŠENO 2026-11-25 · **Effort:** S

**Fix:** `isFeatured` se prosljeđuje iz `importCandidate` u `createFromDto` (`admin.service.ts`), polje dodano u `ParsedEventCandidate` i `ParsedCandidate` tipove, switch „Izdvojeno (featured)" u `parsed-candidate-card.tsx`.
**Dokaz:** 2 Jest testa (`admin.service.spec.ts`: flag prolazi / bez njega događaj nije izdvojen) + 3 Vitest testa (`parsed-candidate-featured.test.tsx`: uključi, isključi, ne diraj). Crveno stanje je prije fixa pokazalo točan payload bez `isFeatured`.

Najmanji zahtjev u batchu, i **polovica je već u kodu**:

| Komad | Stanje |
|---|---|
| `Event.isFeatured Boolean @default(false)` | postoji — `schema.prisma:347` |
| `CandidateOverrideDto.isFeatured?: boolean` | **postoji** — `apps/api/src/admin/admin.dto.ts:119` |
| `events.service.createFromDto` prihvaća `isFeatured` | postoji — `apps/api/src/events/events.service.ts:68` (`dto.isFeatured ?? false`) |
| `importCandidate` prosljeđuje `isFeatured` | **NE** — payload na `admin.service.ts:1084-1115` ga ne navodi; u cijelom `admin.service.ts` `isFeatured` se pojavljuje samo na `427` (duplikat događaja) i `1604` (filter tablice) |
| Kontrola u kartici kandidata | **NE** — `parsed-candidate-card.tsx` nema `isFeatured` (polja: naslov, raspored, grad, venue, adresa, koordinate, organizator, cijena, ulaznice, opis, kategorije, URL izvora) |
| Checkbox u uređivanju gotovog događaja | postoji — `event-edit-form.tsx:494-501`, kolona „Izdvojeno" u tablici `events-table.tsx:90` |

**Važan nalaz:** DTO već validira `isFeatured`, pa klijent koji ga pošalje dobiva `200` — a **vrijednost se tiho ignorira**. To je zamka za implementaciju („polje postoji, dakle radi"). Potrebno: proslijediti ga u `createFromDto`, dodati kontrolu u karticu, i Jest test u `apps/api/test/` koji dokazuje da import s `isFeatured: true` stvara izdvojen događaj — jer bez testa ovaj bug se vraća tiho.

Napomena uz prikaz: javni feed smatra događaj izdvojenim i kad je `extractionConfidence >= 0.85` (`apps/web/src/lib/public-api.ts:508`), neovisno o `isFeatured`. Vrijedi provjeriti je li to namjerno prije nego se ručna oznaka doda — inače admin ne razumije zašto je nešto izdvojeno bez da je kliknuo.

---

## Odluke donesene 2026-11-25 (korisnik)

1. **Izdvojeno je isključivo ručna oznaka.** `extractionConfidence >= 0.85` više ne čini događaj izdvojenim (`apps/web/src/lib/public-api.ts`). Dokaz: 4 Vitest slučaja u `public-api.test.ts`. Naslovnica i dalje popunjava prazninu nefeaturiranim događajima ako ih je manje od tri (`app/page.tsx:58-61`), pa sekcija ne ostaje prazna.
2. **Audit log: samo evidencija brisanja + tko je objavio** (ne puna povijest uređivanja). Novo: `Event.publishedByUserId`, tablica `EventDeletion`, migracija `20261125120000_event_publication_and_deletion_audit`. **Brisanje ostaje stvarno brisanje** — soft delete bi tražio filtriranje u svakom upitu i svakom relation includeu prema javnom webu, a jedan propušteni put vraća obrisani događaj pred posjetitelje. `EventDeletion` je zapis, ne koš za smeće: vraćanje obrisanog događaja iz njega nije moguće. Brisanja prije migracije ne postoje i ne mogu se rekonstruirati — kartica to piše umjesto da prikaže nulu. **Povijest uređivanja i dalje ne postoji** (`updatedAt` bez autora), pa metrika „naknadno uređeni" ostaje izvan statistike.
3. **Masovna obrada bez web pretrage.** Isporučeno `BULK-01`; `BULK-02` (stvarna internetska pretraga) ostaje P3 dok se ne dogovore limiti i trošak.

## Preporučeni redoslijed (max 5 taskova)

1. **FEAT-01** — „Izdvojeno" u kartici kandidata + prosljeđivanje u `createFromDto` + Jest test. (S, zatvara tihi gubitak podatka.)
2. **PARSE-01** — engleski mjeseci i am/pm u `date-evidence.ts`, failing test prvo, dokaz na stvarnom plakatu. (S–M, jedini pravi bug.)
3. **VEN-01/02/03** — autocomplete na polju naziva mjesta + `searchVenues` vraća `name`/`address`, bez `lat/lng` filtra za taj način. (M, najveća ušteda vremena po unosu.)
4. **STAT-01/02/03** — zasebna stranica, kartice, brzi odabir razdoblja, bez e-mail adresa, uz admin guard i E2E provjeru pristupa. (M, pokriva „u nekoliko sekundi vidim tko je koliko unio".)
5. **STAT-05/06/07** — dnevna matrica, heatmap, kronologija razmaka (raw SQL po `Europe/Zagreb`, logika razmaka kroz TDD). (M–L.)

Otvoreno za odluku prije kodiranja: **STAT-RISK-01** (uvodimo li `EventActivity` audit log ili izbacujemo metrike uređivanja/brisanja) i **BULK-02** (opseg i budžet web pretrage). `VEN-04` ne raditi prije `VEN-05` — automatsko povezivanje bez grada upisuje pogrešne adrese.

## Lokalni review prije PR-a (2026-11-25)

Dvoosni review (Standards + Spec) pronašao je i popravljeno je u istom branchu:

- spajanje mjesta nije invalidiralo javni cache, pa bi posjetitelji vidjeli staru adresu i pin;
- preset `Sve vrijeme` počinjao je 2000. godinom → prosjek dijeljen izmišljenim brojem dana i tablica od tisuća praznih redaka;
- statistika je za taj preset dvaput čitala sve događaje (prozor „danas/tjedan/mjesec" bio je proširen na odabrano razdoblje);
- pretraga mjesta uzimala je 20 redaka abecedno **prije** rangiranja po gradu, pa je kod mnogo istoimenih mjesta grad događaja mogao ispasti s popisa i automatsko popunjavanje bi upisalo adresu iz drugog grada (točno VEN-05 rizik);
- CSV ćelije koje počinju s `=`, `+`, `-` ili `@` sada se neutraliziraju (naslovi dolaze iz scrape/LLM izvora);
- masovna obrada ograničena na 40 plakata po pokretanju, uz oslobađanje `objectURL`-ova;
- organizatorsko brisanje odvezivalo je izvore izvan transakcije;
- napomena o evidenciji brisanja više nema ukucan datum.

Svjesno **nije** mijenjano: nema backfilla `isFeatured` za događaje koji su dosad bili izdvojeni samo zbog `extractionConfidence` — odluka je bila da izdvojeno znači isključivo ručnu oznaku.

## Provjere koje ovaj triage nije napravio

- Ništa nije pokrenuto na produkciji: broj događaja s `createdByUserId = NULL`, udio `sourceType ≠ MANUAL`, i koliko plakata pada na poruku „nije potvrđeno izvorom" — sve troje je runtime podatak, ne podatak iz koda.
- Plakat „BOOK AND MUSIC 1" nije uploadan kroz admin UI; uzrok je dokazan izvođenjem helpera `sourceDates`/`sourceTimes` nad citatima iz prijave.
- Nije pokrenut nijedan test paket (`pnpm --filter api test`, `pnpm e2e`) — nije bilo izmjena koda.
- Nije provjereno kako se `VEN-*` ponaša na organizatorskoj strani (`apps/web/app/organizer/`), samo admin tok.
