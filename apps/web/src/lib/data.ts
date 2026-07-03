export type CategorySlug =
  | "glazba"
  | "festivali"
  | "izlozbe"
  | "radionice"
  | "djeca-i-obitelj"
  | "na-otvorenom"
  | "hrana-i-vino"
  | "sajmovi"
  | "sport"
  | "tradicija-i-folklor"
  | "manifestacije"
  | "nocni-zivot"
  | "edukacija"
  | "humanitarno"
  | "udruge"
  | "ostalo"
  // legacy slugs kept for backward compat
  | "outdoor"
  | "kultura"

export type RegionSlug =
  | "dalmacija"
  | "istra"
  | "zagreb"
  | "slavonija"
  | "kvarner"
  | "lika"

export interface Category {
  slug: CategorySlug
  name: string
  tagline: string
  /** two oklch stops for the gradient placeholder */
  gradient: [string, string]
}

export interface Region {
  slug: RegionSlug
  name: string
  county: string
  blurb: string
  image: string
}

export interface CroEvent {
  slug: string
  title: string
  category: CategorySlug
  categories: { slug: string; name: string }[]
  region: RegionSlug
  city: string
  venue: string
  /** ISO date */
  date: string
  endDate?: string
  time: string
  allDay?: boolean
  free: boolean
  price?: string
  forKids: boolean
  outdoor: boolean
  description: string
  longDescription: string
  organizer: string
  source: string
  ticketUrl?: string
  image?: string
  imageAlt?: string
  featured?: boolean
  address?: string
  lat?: number
  lng?: number
  /** rough map position in % within the discovery map */
  map: { x: number; y: number }
}

// Display label overrides for backend slugs shown in public UI.
export const CATEGORY_DISPLAY: Record<string, string> = {
  "glazba":              "Glazba",
  "festivali":           "Festivali",
  "izlozbe":             "Izložbe",
  "radionice":           "Radionice",
  "djeca-i-obitelj":     "Za djecu",
  "na-otvorenom":        "Na otvorenom",
  "hrana-i-vino":        "Gastro & vino",
  "sajmovi":             "Sajmovi",
  "sport":               "Sport",
  "tradicija-i-folklor": "Tradicija i folklor",
  "manifestacije":       "Manifestacije",
  "nocni-zivot":         "Noćni život",
  "edukacija":           "Edukacija",
  "humanitarno":         "Humanitarno",
  "udruge":              "Udruge",
  "ostalo":              "Ostalo",
  // legacy slugs
  "outdoor":             "Na otvorenom",
  "kultura":             "Kultura",
}

// Category strip shown on homepage — curated subset using backend slugs.
export const categories: Category[] = [
  {
    slug: "glazba",
    name: "Glazba",
    tagline: "Koncerti i glazbeni programi",
    gradient: ["oklch(0.42 0.11 256)", "oklch(0.62 0.13 28)"],
  },
  {
    slug: "festivali",
    name: "Festivali",
    tagline: "Višednevni programi i ljetne scene",
    gradient: ["oklch(0.4 0.1 300)", "oklch(0.55 0.14 20)"],
  },
  {
    slug: "radionice",
    name: "Radionice",
    tagline: "Učenje, zanati i kreativni susreti",
    gradient: ["oklch(0.45 0.09 200)", "oklch(0.6 0.12 150)"],
  },
  {
    slug: "djeca-i-obitelj",
    name: "Za djecu",
    tagline: "Programi za djecu i cijelu obitelj",
    gradient: ["oklch(0.55 0.13 60)", "oklch(0.65 0.14 110)"],
  },
  {
    slug: "na-otvorenom",
    name: "Na otvorenom",
    tagline: "Priroda, planinarenje i avantura",
    gradient: ["oklch(0.45 0.1 160)", "oklch(0.6 0.11 220)"],
  },
  {
    slug: "hrana-i-vino",
    name: "Gastro & vino",
    tagline: "Okusi regije, vino i delicije",
    gradient: ["oklch(0.5 0.13 40)", "oklch(0.58 0.12 90)"],
  },
  {
    slug: "izlozbe",
    name: "Izložbe",
    tagline: "Umjetnost, fotografija i baština",
    gradient: ["oklch(0.4 0.07 270)", "oklch(0.55 0.09 320)"],
  },
  {
    slug: "tradicija-i-folklor",
    name: "Tradicija i folklor",
    tagline: "Lokalne tradicije i gradske fešte",
    gradient: ["oklch(0.45 0.1 24)", "oklch(0.58 0.12 60)"],
  },
]

export const regions: Region[] = [
  {
    slug: "dalmacija",
    name: "Dalmacija",
    county: "Split · Zadar · Šibenik · Dubrovnik",
    blurb:
      "Kamene rive, klape pod zvijezdama i ljetne scene uz Jadran — od starogradskih trgova do otočnih uvala.",
    image: "/images/region-dalmacija.png",
  },
  {
    slug: "istra",
    name: "Istra",
    county: "Pula · Rovinj · Motovun",
    blurb:
      "Brežuljci, maslinici i festivali okusa. Zelena Istra spaja vrhunsku gastronomiju s filmom i glazbom.",
    image: "/images/region-istra.png",
  },
  {
    slug: "zagreb",
    name: "Zagreb i okolica",
    county: "Zagreb · Samobor · Zagorje",
    blurb:
      "Gradska kultura tijekom cijele godine — koncerti, kazališta, izložbe i živahne kvartovske fešte.",
    image: "/images/region-zagreb.png",
  },
  {
    slug: "slavonija",
    name: "Slavonija",
    county: "Osijek · Đakovo · Vukovar",
    blurb:
      "Zlatne ravnice, tamburica i bogata tradicija. Manifestacije koje slave baštinu i domaće okuse.",
    image: "/images/region-slavonija.png",
  },
  {
    slug: "kvarner",
    name: "Kvarner",
    county: "Rijeka · Opatija · Krk",
    blurb:
      "Rivijera s dugom karnevalskom tradicijom, glazbenim večerima i šetnicama uz more.",
    image: "/images/region-kvarner.jpg",
  },
  {
    slug: "lika",
    name: "Lika i gorje",
    county: "Gospić · Plitvice · Velebit",
    blurb:
      "Planine, jezera i čist zrak. Avanturistički i outdoor programi u srcu hrvatske divljine.",
    image: "/images/region-lika.jpg",
  },
]

export const events: CroEvent[] = [
  {
    slug: "noci-stare-jezgre",
    title: "Noći stare jezgre",
    category: "festivali",
    categories: [{ slug: "festivali", name: "Festivali" }, { slug: "glazba", name: "Glazba" }],
    region: "dalmacija",
    city: "Split",
    venue: "Dioklecijanova palača",
    date: "2026-07-11",
    endDate: "2026-07-13",
    time: "20:00",
    free: true,
    forKids: true,
    outdoor: true,
    description:
      "Tri večeri glazbe, svjetla i uličnih izvedbi među zidinama drevne palače.",
    longDescription:
      "Najljepši dijelovi Dioklecijanove palače pretvaraju se u pozornicu pod otvorenim nebom. Klapske večeri, jazz kvarteti i svjetlosne instalacije vode posjetitelje kroz uske kamene uličice. Program je besplatan i prilagođen svim uzrastima, uz posebnu dječju zonu na Peristilu.",
    organizer: "Turistička zajednica grada Splita",
    source: "Visit Split",
    ticketUrl: "https://example.com",
    image: "/images/hero-night.png",
    featured: true,
    map: { x: 46, y: 72 },
  },
  {
    slug: "more-i-zvuk",
    title: "More i zvuk — koncert na rivi",
    category: "glazba",
    categories: [{ slug: "glazba", name: "Glazba" }],
    region: "dalmacija",
    city: "Zadar",
    venue: "Pozdrav suncu, Riva",
    date: "2026-07-04",
    time: "21:00",
    free: false,
    price: "od 18 €",
    forKids: false,
    outdoor: true,
    description:
      "Akustični koncert uz zalazak sunca i morske orgulje kao prirodnu kulisu.",
    longDescription:
      "Dok sunce tone u Jadran, domaći i regionalni izvođači sviraju uz pratnju morskih orgulja. Intiman ambijent, ograničen broj mjesta i nezaboravan pogled na zadarski zaljev.",
    organizer: "Zadar Concerts",
    source: "Zadar Concerts",
    ticketUrl: "https://example.com",
    image: "/images/event-concert.png",
    featured: true,
    map: { x: 40, y: 60 },
  },
  {
    slug: "okusi-istre",
    title: "Okusi Istre — sajam vina i tartufa",
    category: "hrana-i-vino",
    categories: [{ slug: "hrana-i-vino", name: "Hrana i vino" }, { slug: "festivali", name: "Festivali" }],
    region: "istra",
    city: "Motovun",
    venue: "Trg Andrea Antico",
    date: "2026-07-05",
    time: "11:00",
    free: false,
    price: "12 €",
    forKids: true,
    outdoor: true,
    description:
      "Degustacije lokalnih vina, maslinovih ulja i jela s tartufima na brežuljku.",
    longDescription:
      "Mali srednjovjekovni Motovun domaćin je najukusnijem danu u godini. Vinari iz cijele Istre predstavljaju etikete uz živu glazbu, dok kuhari pripremaju fuže s tartufima na licu mjesta. Ulaznica uključuje degustacijsku čašu.",
    organizer: "Vinari Istre",
    source: "Istra Inspirit",
    ticketUrl: "https://example.com",
    image: "/images/event-food.png",
    featured: true,
    map: { x: 16, y: 30 },
  },
  {
    slug: "glina-i-ruke",
    title: "Glina i ruke — keramička radionica",
    category: "radionice",
    categories: [{ slug: "radionice", name: "Radionice" }],
    region: "istra",
    city: "Rovinj",
    venue: "Atelier Mali Sv. Križ",
    date: "2026-07-08",
    time: "17:30",
    free: false,
    price: "35 €",
    forKids: false,
    outdoor: false,
    description:
      "Naučite osnove lončarstva uz lokalnu majstoricu u sunčanom ateljeu.",
    longDescription:
      "Dvosatna radionica za početnike u kojoj svaki polaznik izrađuje vlastitu zdjelu. Materijali i pečenje uključeni su u cijenu, a gotovi radovi šalju se poštom nakon sušenja.",
    organizer: "Atelier Mali Sv. Križ",
    source: "Rovinj Culture",
    image: "/images/event-workshop.png",
    map: { x: 14, y: 34 },
  },
  {
    slug: "mali-istrazivaci",
    title: "Mali istraživači — dan za obitelj",
    category: "djeca-i-obitelj",
    categories: [{ slug: "djeca-i-obitelj", name: "Djeca i obitelj" }, { slug: "na-otvorenom", name: "Na otvorenom" }],
    region: "zagreb",
    city: "Zagreb",
    venue: "Park Maksimir",
    date: "2026-06-28",
    time: "10:00",
    free: true,
    forKids: true,
    outdoor: true,
    description:
      "Igre, lov na blago i kreativne radionice za djecu u najljepšem parku grada.",
    longDescription:
      "Cijeli dan zabave za najmlađe: potraga za blagom kroz park, radionice slikanja, lutkarske predstave i prirodoslovne igre. Ulaz je slobodan, a roditeljima su na raspolaganju kutci za odmor uz kavu.",
    organizer: "Javna ustanova Maksimir",
    source: "Zagreb.hr",
    image: "/images/event-family.png",
    featured: true,
    map: { x: 30, y: 16 },
  },
  {
    slug: "velebit-izlazak-sunca",
    title: "Velebit — pohod na izlazak sunca",
    category: "na-otvorenom",
    categories: [{ slug: "na-otvorenom", name: "Na otvorenom" }, { slug: "sport", name: "Sport" }],
    region: "lika",
    city: "Starigrad",
    venue: "Premužićeva staza",
    date: "2026-07-12",
    time: "04:30",
    free: false,
    price: "25 €",
    forKids: false,
    outdoor: true,
    description:
      "Vođeni noćni uspon do vrha s pogledom na Jadran u prvim zrakama sunca.",
    longDescription:
      "Iskusni planinarski vodič vodi grupu na ranojutarnji uspon kako biste izlazak sunca dočekali iznad oblaka. Uključeni su vodič, čaj i lagani doručak na vrhu. Potrebna je osnovna fizička spremnost i planinarska obuća.",
    organizer: "HPD Paklenica",
    source: "Outdoor Croatia",
    ticketUrl: "https://example.com",
    image: "/images/event-outdoor.png",
    map: { x: 34, y: 48 },
  },
  {
    slug: "svjetlo-i-sjena",
    title: "Svjetlo i sjena — izložba fotografije",
    category: "izlozbe",
    categories: [{ slug: "izlozbe", name: "Izložbe" }],
    region: "zagreb",
    city: "Zagreb",
    venue: "Galerija Klovićevi dvori",
    date: "2026-06-30",
    endDate: "2026-08-15",
    time: "10:00 – 20:00",
    free: false,
    price: "8 €",
    forKids: false,
    outdoor: false,
    description:
      "Retrospektiva hrvatske dokumentarne fotografije kroz pet desetljeća.",
    longDescription:
      "Više od 200 fotografija prati promjene hrvatskog društva i krajolika od 1970-ih do danas. Postav je popraćen vođenim obilascima vikendom i razgovorima s autorima.",
    organizer: "Klovićevi dvori",
    source: "Galerija Klovićevi dvori",
    ticketUrl: "https://example.com",
    image: "/images/event-art.png",
    map: { x: 29, y: 15 },
  },
  {
    slug: "slavonski-banket",
    title: "Slavonski banket — fešta okusa",
    category: "tradicija-i-folklor",
    categories: [{ slug: "tradicija-i-folklor", name: "Tradicija i folklor" }, { slug: "hrana-i-vino", name: "Hrana i vino" }],
    region: "slavonija",
    city: "Đakovo",
    venue: "Trg J. J. Strossmayera",
    date: "2026-07-19",
    time: "18:00",
    free: true,
    forKids: true,
    outdoor: true,
    description:
      "Tamburice, kulen i domaće delicije u srcu slavonske ravnice.",
    longDescription:
      "Tradicionalna gradska fešta okuplja obiteljska gospodarstva, vinare i tamburaške sastave. Posjetitelji kušaju domaće specijalitete dok se na glavnoj pozornici izmjenjuju folklorni i glazbeni programi.",
    organizer: "Grad Đakovo",
    source: "Visit Slavonija",
    image: "/images/region-slavonija.png",
    map: { x: 76, y: 38 },
  },
  {
    slug: "ljetna-pozornica-pula",
    title: "Ljetna pozornica — Arena uživo",
    category: "glazba",
    categories: [{ slug: "glazba", name: "Glazba" }, { slug: "festivali", name: "Festivali" }],
    region: "istra",
    city: "Pula",
    venue: "Pulska Arena",
    date: "2026-07-25",
    time: "21:30",
    free: false,
    price: "od 32 €",
    forKids: false,
    outdoor: true,
    description:
      "Koncert u dvije tisuće godina staroj rimskoj areni pod zvjezdanim nebom.",
    longDescription:
      "Jedinstven doživljaj glazbe uživo u jednom od najbolje očuvanih rimskih amfiteatara na svijetu. Akustika, povijest i atmosfera spajaju se u nezaboravnu večer.",
    organizer: "Arena Festival",
    source: "Arena Pula",
    ticketUrl: "https://example.com",
    image: "/images/event-concert.png",
    map: { x: 12, y: 40 },
  },
  {
    slug: "kvarnerski-vez",
    title: "Kvarnerski vez — radionica čipke",
    category: "radionice",
    categories: [{ slug: "radionice", name: "Radionice" }, { slug: "tradicija-i-folklor", name: "Tradicija i folklor" }],
    region: "kvarner",
    city: "Opatija",
    venue: "Villa Angiolina",
    date: "2026-07-02",
    time: "16:00",
    free: false,
    price: "20 €",
    forKids: true,
    outdoor: false,
    description:
      "Tradicionalni vez i čipka uz priču o kvarnerskoj baštini.",
    longDescription:
      "Polaznici uče osnovne tehnike veza pod vodstvom članica lokalne udruge. Radionica je prikladna za sve uzraste, a djeca uz pratnju sudjeluju besplatno.",
    organizer: "Udruga Kvarnerski vez",
    source: "Visit Opatija",
    map: { x: 22, y: 38 },
  },
  {
    slug: "filmske-veceri-na-trgu",
    title: "Filmske večeri na trgu",
    category: "festivali",
    categories: [{ slug: "festivali", name: "Festivali" }, { slug: "izlozbe", name: "Izložbe" }],
    region: "zagreb",
    city: "Samobor",
    venue: "Glavni trg",
    date: "2026-07-15",
    endDate: "2026-07-18",
    time: "21:00",
    free: true,
    forKids: true,
    outdoor: true,
    description:
      "Ljetni open-air kino program s najboljim domaćim i europskim filmovima.",
    longDescription:
      "Četiri večeri filma pod vedrim nebom na živopisnom samoborskom trgu. Ulaz je besplatan, a uz projekcije organiziran je i program za djecu u ranim večernjim satima.",
    organizer: "Pučko otvoreno učilište Samobor",
    source: "Samobor Kultura",
    image: "/images/hero-night.png",
    map: { x: 26, y: 18 },
  },
  {
    slug: "jadranski-okusi-kvarner",
    title: "Jadranski okusi — večer ribe",
    category: "hrana-i-vino",
    categories: [{ slug: "hrana-i-vino", name: "Hrana i vino" }, { slug: "na-otvorenom", name: "Na otvorenom" }],
    region: "kvarner",
    city: "Rijeka",
    venue: "Korzo",
    date: "2026-07-09",
    time: "19:00",
    free: false,
    price: "15 €",
    forKids: false,
    outdoor: true,
    description:
      "Ulična gastro tura s degustacijom svježe ribe i kvarnerskih vina.",
    longDescription:
      "Šetnja riječkim Korzom uz štandove lokalnih restorana koji predstavljaju svoje najbolje riblje specijalitete. Cijena uključuje pet degustacijskih porcija i čašu vina.",
    organizer: "Rijeka Gastro",
    source: "Visit Rijeka",
    image: "/images/event-food.png",
    map: { x: 21, y: 36 },
  },
]

/* ---------- helpers ---------- */

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug)
}

export function getRegion(slug: string) {
  return regions.find((r) => r.slug === slug)
}

/** Transform a Cloudinary URL to deliver an optimised, auto-cropped variant.
 *  Non-Cloudinary URLs are returned unchanged. */
export function cloudinaryImage(
  url: string | undefined | null,
  opts: { w: number; h: number } = { w: 800, h: 600 },
): string | undefined {
  if (!url) return undefined
  if (!url.includes("res.cloudinary.com")) return url
  // Insert transformation before the version segment (/v123456789/...)
  return url.replace(
    /\/upload\//,
    `/upload/c_fill,g_auto,f_auto,q_auto,w_${opts.w},h_${opts.h}/`,
  )
}

export function getEvent(slug: string) {
  return events.find((e) => e.slug === slug)
}

export function categoryName(slug: string) {
  return CATEGORY_DISPLAY[slug] ?? getCategory(slug as CategorySlug)?.name ?? slug
}

export function regionName(slug: RegionSlug) {
  return getRegion(slug)?.name ?? slug
}

export function gradientFor(slug: string): string {
  const cat = getCategory(slug as CategorySlug)
  if (!cat) return "linear-gradient(135deg, oklch(0.4 0.08 256), oklch(0.55 0.1 28))"
  return `linear-gradient(135deg, ${cat.gradient[0]}, ${cat.gradient[1]})`
}

const I = (name: string) => `/images/categories/${name}.jpg`

const CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
  "glazba":              [I("glazba-1"), I("glazba-2"), I("glazba-3")],
  "festivali":           [I("festivali-1"), I("festivali-2"), I("festivali-3")],
  "izlozbe":             [I("izlozbe-1"), I("izlozbe-2")],
  "radionice":           [I("radionice-1")],
  "djeca-i-obitelj":    [I("djeca-i-obitelj-1"), I("djeca-i-obitelj-2")],
  "hrana-i-vino":        [I("hrana-i-vino-1"), I("hrana-i-vino-2")],
  "sajmovi":             [I("sajmovi-1"), I("sajmovi-2"), I("sajmovi-3")],
  "sport":               [I("sport-1"), I("sport-2"), I("sport-3")],
  "tradicija-i-folklor": [I("tradicija-i-folklor-1"), I("tradicija-i-folklor-2"), I("tradicija-i-folklor-3")],
  "nocni-zivot":         [I("nocni-zivot-1")],
  "edukacija":           [I("edukacija-1"), I("edukacija-2"), I("edukacija-3")],
  "humanitarno":         [I("humanitarno-1"), I("humanitarno-2")],
  "udruge":              [I("udruge-1"), I("udruge-2")],
  "manifestacije":       [I("manifestacije-1"), I("manifestacije-2")],
  "na-otvorenom":        [I("na-otvorenom-1"), I("na-otvorenom-2")],
  "ostalo":              [I("ostalo-1"), I("ostalo-2")],
}

function stringHash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return Math.abs(h)
}

export function categoryFallbackImage(categorySlug: string, seed: string): string {
  const images = CATEGORY_FALLBACK_IMAGES[categorySlug] ?? CATEGORY_FALLBACK_IMAGES["ostalo"] ?? []
  if (!images.length) return ""
  return images[stringHash(seed) % images.length]
}

/* ---------- queries ---------- */

function byDate(a: CroEvent, b: CroEvent) {
  return a.date.localeCompare(b.date)
}

export function eventsByRegion(slug: string) {
  return events.filter((e) => e.region === slug).sort(byDate)
}

export function eventsByCategory(slug: string) {
  return events.filter((e) => eventHasCategory(e, slug)).sort(byDate)
}

export function featuredEvents(limit?: number) {
  const list = events.filter((e) => e.featured).sort(byDate)
  return typeof limit === "number" ? list.slice(0, limit) : list
}

export function upcomingEvents(limit?: number) {
  const list = [...events].sort(byDate)
  return typeof limit === "number" ? list.slice(0, limit) : list
}

export function freeEvents(limit?: number) {
  const list = events.filter((e) => e.free).sort(byDate)
  return typeof limit === "number" ? list.slice(0, limit) : list
}

export interface EventFilters {
  q?: string
  category?: string
  region?: string
  city?: string
  free?: boolean
  kids?: boolean
  outdoor?: boolean
  when?: "danas" | "ovaj-vikend" | "ovaj-mjesec"
}

function inWeekend(iso: string) {
  const d = new Date(iso + "T00:00:00")
  const day = d.getDay()
  return day === 5 || day === 6 || day === 0
}

export function filterEvents(f: EventFilters) {
  const q = f.q?.trim().toLowerCase()
  return events
    .filter((e) => {
      if (f.category && !eventHasCategory(e, f.category)) return false
      if (f.region && e.region !== f.region) return false
      if (f.city && e.city.toLowerCase() !== f.city.toLowerCase()) return false
      if (f.free && !e.free) return false
      if (f.kids && !e.forKids) return false
      if (f.outdoor && !e.outdoor) return false
      if (f.when === "ovaj-vikend" && !inWeekend(e.date)) return false
      if (q) {
        const hay = `${e.title} ${e.description} ${e.city} ${e.venue} ${e.organizer}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort(byDate)
}

export function relatedEvents(e: CroEvent, limit = 3) {
  return events
    .filter((x) => x.slug !== e.slug && (x.region === e.region || e.categories.some((c) => eventHasCategory(x, c.slug))))
    .sort(byDate)
    .slice(0, limit)
}

export function eventHasCategory(event: CroEvent, slug: string) {
  return event.category === slug || event.categories.some((category) => category.slug === slug)
}

const MONTHS_HR = [
  "sij",
  "velj",
  "ožu",
  "tra",
  "svi",
  "lip",
  "srp",
  "kol",
  "ruj",
  "lis",
  "stu",
  "pro",
]

export const MONTHS_HR_LONG = [
  "siječnja",
  "veljače",
  "ožujka",
  "travnja",
  "svibnja",
  "lipnja",
  "srpnja",
  "kolovoza",
  "rujna",
  "listopada",
  "studenoga",
  "prosinca",
]

export const MONTHS_HR_NOM = [
  "Siječanj",
  "Veljača",
  "Ožujak",
  "Travanj",
  "Svibanj",
  "Lipanj",
  "Srpanj",
  "Kolovoz",
  "Rujan",
  "Listopad",
  "Studeni",
  "Prosinac",
]

const WEEKDAYS_HR = [
  "Nedjelja",
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
]

export const WEEKDAY_SHORT_HR = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"]

export function dateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function dateParts(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return {
    day: d.getDate(),
    month: MONTHS_HR[d.getMonth()],
    monthLong: MONTHS_HR_LONG[d.getMonth()],
    weekday: WEEKDAYS_HR[d.getDay()],
    year: d.getFullYear(),
  }
}

export function eventOccursOn(event: CroEvent, day: Date) {
  const key = dateKey(day)
  const start = event.date
  const end = event.endDate || event.date
  return key >= start && key <= end
}

export function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date, inMonth: date.getMonth() === month }
  })
}

export function formatDateRange(start: string, end?: string) {
  const s = dateParts(start)
  if (!end || end === start) return `${s.weekday}, ${s.day}. ${s.monthLong} ${s.year}.`
  const e = dateParts(end)
  return `${s.day}. ${s.monthLong} – ${e.day}. ${e.monthLong} ${e.year}.`
}

export function priceLabel(e: CroEvent) {
  return e.free ? "Besplatno" : e.price ?? "Naplata"
}

/* ---------- geo coordinates (lat, lng) by city ---------- */

export const CITY_COORDS: Record<string, [number, number]> = {
  Osijek: [45.555, 18.695],
  Split: [43.5081, 16.4402],
  Zadar: [44.1194, 15.2314],
  Motovun: [45.3367, 13.8278],
  Rovinj: [45.0811, 13.6387],
  Zagreb: [45.815, 15.9819],
  Vukovar: [45.351, 19.003],
  Vinkovci: [45.288, 18.804],
  Našice: [45.488, 18.087],
  Valpovo: [45.66, 18.418],
  "Beli Manastir": [45.771, 18.603],
  Starigrad: [44.2978, 15.4583],
  Đakovo: [45.3089, 18.4108],
  Pula: [44.8666, 13.8496],
  Opatija: [45.3377, 14.3053],
  Samobor: [45.8033, 15.7114],
  Rijeka: [45.3271, 14.4422],
}

export function coordsFor(e: CroEvent): [number, number] {
  if (e.lat != null && e.lng != null) return [e.lat, e.lng]
  return CITY_COORDS[e.city] ?? [45.1, 15.5]
}
