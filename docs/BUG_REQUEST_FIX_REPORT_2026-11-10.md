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

### 1.5 Prijava i resetiranje lozinke za organizatora bez računa (AUTH-01, AUTH-02, str. 1, 7–9)

**Stanje u produkciji.** Nije bilo greške u lozinkama, nego organizatora bez korisničkog
računa:

| adresa | korisnik | organizator | što se događalo |
|---|---|---|---|
| `hoochymammma@gmail.com` | ne postoji | 341 „d", status `CLAIMED`, `hasUser: false` | prijava → „Email ili lozinka nisu ispravni"; zaboravljena lozinka → generička potvrda, **bez slanja ikakve poruke** |
| `schleisv@gmail.com` | 32 (vezan na organizatora 342 „Zjen") | i 107 „udruga rasta", `CLAIMED`, `hasUser: false`, 2 događaja | registracija → „adresa je već registrirana"; prijava radi s točnom lozinkom; događaji pod 107 su joj nedostupni |

Tablica Dostava emailova nije sadržavala **ni jedan** zapis predloška `password_reset`
prije 10. 11. 2026. — potvrda da zahtjev nikad nije došao do slanja, a ne da je poruka
izgubljena kod pružatelja.

**Uzrok.** `AuthService.login` je ponudu „preuzmite profil" vezao na `OrganizerStatus`
(`status: "UNCLAIMED"`). Admin koji organizatora prebaci u `CLAIMED`/`VERIFIED` time ne
stvara račun, pa je svaki takav organizator postao slijepa ulica u oba smjera: generička
pogreška na prijavi i ništa na resetu. Claim servis isti uvjet već ima ispravno zapisan
(„`users.length > 0` je pravi signal, NE `OrganizerStatus`") — prijava je odstupala od
toga.

**Popravljeno** (`6ea40ae6`):

- prijava nudi claim kad organizator nema vezanog korisnika, bez obzira na status
- `forgot-password` za adresu bez računa, a s nepreuzetim organizatorom, šalje **poveznicu
  za preuzimanje profila** (`OrganizerClaimService.inviteUnclaimedByEmail`); odgovor
  ostaje znak za znak isti, pa to ne odaje postoji li račun
- `register` stvara organizatora i korisnika u jednoj transakciji — neuspjeli unos
  korisnika više ne može ostaviti organizatora bez računa
- testovi: prijava za `CLAIMED` organizatora bez računa, oba ishoda `forgot-password`,
  i dva testa za `inviteUnclaimedByEmail`

**Reset lozinke radi.** Zahtjev poslan s produkcijskog `/forgot-password` za adminovu
adresu stvorio je zapis `password_reset / accepted / prov=resend` u 12:05, 10. 11. 2026.
Statusi dostave ipak ostaju na `accepted` jer Resend webhook nije spojen (vidi 3).

**Provjereno na produkciji nakon deploya (10. 11. 2026., 13:16):**

- prijava za `hoochymammma@gmail.com` prije deploya: `401 {"message":"Email ili lozinka
  nisu ispravni."}`; u 13:16:45 ista prijava vraća
  `403 {"code":"CLAIM_REQUIRED","organizerSlug":"d"}` — osoba sada dobiva uputu, ne
  slijepu ulicu
- poslan poziv za preuzimanje profila organizatoru 341 kroz Administracija →
  Organizatori (poruka „Poziv poslan: d"); zahtjev 4 u bazi ima
  `EMAIL_VERIFICATION_SENT`, adresa `hoochymammma@gmail.com`
- put `forgot-password` → claim poveznica pokriven je testovima; provjera na produkciji
  tražila bi privremenu izmjenu tuđeg zapisa, što je blokirano zaštitom od pisanja u
  produkciju

**Dodatni nalaz: zahtjev koji nitko nije obradio.** Zahtjev za preuzimanje broj **2**
(organizator 107 „udruga rasta", `schleisv@gmail.com`) stoji u statusu
`NEEDS_ADMIN_REVIEW` od **21. 7. 2026.** Odobrenje samo po sebi ne pomaže: korisnik 32
već je vezan na organizatora 342 „Zjen", pa bi `completeClaim` pao na „Ovaj račun je već
povezan s drugim organizatorom". Stanje:

| organizator | događaji | korisnik |
|---|---|---|
| 107 „udruga rasta" | 2 | nema |
| 342 „Zjen" | 0 | 32 (`schleisv@gmail.com`) |
| 369 „test" | 1 | 33 (`vanesa.schleis.zjen@gmail.com`) |

Predlažem: u Administracija → Događaji prebaciti ta 2 događaja s „udruga rasta" na „Zjen"
(obrazac za uređivanje ima polje Organizator), pa zahtjev 2 odbiti i 107 obrisati. Druga
mogućnost — prevezati korisnika 32 na 107 — nema admin sučelje ni rutu.

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
| Prijava `schleis` / `hoochy` / `schleisv@gmail` (AUTH-01) | **riješeno 10. 11. 2026., vidi 1.5** | prvotno preskočeno tvojom odlukom; naknadno obrađeno s podacima iz produkcije |
| Spajanje profila „udruga rasta" (organizator 107) i „Zjen" (342) | treba tvoja odluka | ista adresa `schleisv@gmail.com`, ali 107 nema korisnika i nosi 2 događaja; claim ne može proći jer je korisnik 32 već vezan na 342 |
| Resend webhook za statuse dostave | otvoreno | svi zapisi u Dostavi emailova stoje na `accepted`, nikad `delivered`/`bounced`; `POST /api/webhooks/resend` postoji i traži `RESEND_WEBHOOK_SECRET` — treba ga spojiti u Resendu da se vidi je li poruka stigla |
| „Na mobitelu karta izgleda čudno" | treba tvoja potvrda | prethodno provjereno na 390/360 px u listopadu; ako i dalje izgleda krivo, treba screenshot s uređaja i modelom |

---

## 4. Provjereno na produkciji kroz prijavljeni preglednik

1. **Vrati** — izvor 1019 (kinematografi-osijek, tjedni pregled), kartica „Ignorirani":
   klik na „Vrati" kod kandidata *Hunger Games: Sunrise on the Reaping*. Poruka
   „Vraćeno na čekanje", brojači 6 → 5 ignoriranih i 0 → 1 na čekanju, a API potvrđuje
   `_status: pending` i izvor natrag u `PARSED`. Nakon provjere kandidat je vraćen u
   ignorirano stanje (izvor ponovno `LINKED`, 6 ignoriranih), pa je produkcija u
   zatečenom stanju.
2. **Pregledaj skicu** — Događaji → status Skica (3 komada) → *Alpe Adria Jet Ski Tour
   (kopija)*. Otvara `?preview=<token>`, naslov „Pregled: …", `robots: noindex, nofollow`
   i traka „Pregled za uredništvo". Ista adresa bez tokena vraća 404, kao i s tokenom
   kojemu je izmijenjen rok, pa skica ostaje nedostupna.
3. **GA4** — uzrok je bio da parametri obrasca nisu bili registrirani: svojstvo je imalo
   samo dimenziju „Source component". Dodane su dvije dimenzije dosega *Event*:
   **Form ID** (`form_id`) i **Form destination** (`form_destination`).
   **Nisu retroaktivne** — prikazuju podatke od 10. 11. 2026. nadalje, pa za dosadašnjih
   122 unosa i dalje nema razlučivanja po obrascu.

## 4a. Prolaz klikom kroz admin i javni web (10. 11., prijavljeni preglednik)

Prvi prolaz oslanjao se na kod i testove. Ovo je provjereno klikom, u produkciji:

| Stavka | Nalaz |
|---|---|
| Datumi iz raspona — živi AI put | Testni izvor s tekstom „13.-15. studenoga 2026. / 19:00 - 23:00" vratio je **popunjen** termin 13. 11. 19:00 → 15. 11. 23:00, bez `missingFields`, uz upozorenje „Izvor navodi više termina … provjerite odabrani" i status *Za pregled*. Prije popravka ovo je ostajalo prazno. Testni izvor **id 1020 „TEST PARSER - obrisati" treba obrisati ručno** |
| Brisanje završetka (EVT-06) | Na skici *Alpe Adria Jet Ski Tour (kopija)*: upisan završetak 11:30 → spremljeno; polje ispražnjeno → spremljeno kao prazno. Skica vraćena u zatečeno stanje |
| Rich-text (EVT-03) | Uređivač nudi Podebljano, Kurziv, Poveznica, Popis |
| Dopuna AI-em (EVT-08) | „Dopuni podatke pomoću AI" na događaju, „Dopuni i ponovno parsiraj" + dodatne slike na izvoru |
| Upozorenje na duplikate (EVT-11) | Unos naziva i datuma postojećeg događaja odmah prikazuje „Mogući duplikat — provjerite prije kreiranja" s pogođenim događajem |
| Zadano Besplatno (EVT-10) | Novi događaj: „Način naplate" = FREE |
| Uređivanje u listi (EVT-09) | Redak nudi kontrole za Početak, Kraj, Grad, Kategorije, Status i Način naplate (stupac je u ovom računu bio sakriven — uključuje se preko „Kolone") |
| Pretraga organizatora (ADM-01) | 340 redaka → filtrirano na traženog organizatora, neovisno o velikim slovima |
| Broj događaja po organizatoru (ADM-02) | Stupac „Povezani događaji" + radnja „Prikaži događaje" |
| Tko je koliko unio, od–do (ADM-03) | Filtar „Dodao" nabraja autore; 1. 10.–10. 11. daje 308 događaja, a za Andrijanu 158 |
| Notifikacije (NOT-01/02/04) | Kategorije s brojačima (nova registracija organizatora 20, novi događaj organizatora 6 · 7 čeka pregled), „Označi kao pročitano" po stavci i „Označi sve kao pročitano" (nisam klikao da ne obrišem vaše nepročitano) |
| Izmjene organizatora na pregled (EVT-02) | Stranica „Izmjene objavljenih događaja" radi; trenutno nema izmjena na čekanju. Sama prijava izmjene traži organizatorski račun, to nije testirano |
| Prekonoćni termin (PUB-04) | *WCS Halloween Party*: „Subota, 31. listopada 2026. · 20:00–02:00", bez oznake višednevnog |
| Povratak na kalendar (PUB-02) | Iz kalendara (mjesec, 5. 12.) u događaj pa „Natrag na kalendar": vraćen `?pogled=mjesec&datum=2026-12-05` i pozicija skrola |
| Karta na mobitelu (PUB-01) | Izmjereno na 390×719: karta je bila na y=591 i cijela ispod pregiba. **Popravljeno** — sada počinje na y=206, visoka 431 px; desktop raspored nepromijenjen |
| Kalendar otvara prošli tjedan | **Novi bug, popravljen.** Na 10. 11. kalendar se otvarao na tjednu 2.–8. studenoga jer je kao polazni datum uzimao najraniji događaj u feedu. Sada otvara tekući tjedan (produkcija: 9.–15. studenoga) |

Ostaje neprovjereno klikom: slanje e-maila organizatoru pri objavi (NOT-03) i prijava izmjene s organizatorske strane (EVT-02) — oboje traži organizatorski račun i stvarni mailbox; te ponašanje vikend-stranice na subotu, što se može dokazati samo testom (zelen).

## 5. Commitovi

| Commit | Opis |
|---|---|
| `276dc1a8` | feat(admin): restore an ignored parsed candidate |
| `b7bb2562` | test(web): restore Web Storage in the jsdom test environment |
| `03c135ce` | fix(parser): keep dates a poster states as a range or in shorthand |
| `9fe926a7` | test(parser): cover the reported sign-up poster schedule |
| `dfb1bd97` | feat(admin): preview an unpublished event on its real public page |
| `7772a2e1` | fix(web): show the map first on a phone |
| `9c45d876` | fix(web): open the calendar on the current week |
| `6ea40ae6` | fix(api): let an organizer with no account actually get in |

Svaki je razvijen na vlastitoj grani i spojen u `main` s `--no-ff`.
