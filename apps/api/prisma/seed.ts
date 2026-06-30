import { PrismaClient, EventStatus, EventSourceKind, OrganizerStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const seedDemoData = process.env.SEED_DEMO_DATA === "true";

if (!adminEmail) {
  throw new Error("SEED_ADMIN_EMAIL must be set before running seed");
}
if (!adminPassword) {
  throw new Error("SEED_ADMIN_PASSWORD must be set before running seed");
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  const regions = [
    "Slavonija i Baranja",
    "Zagreb i okolica",
    "Dalmacija",
    "Istra i Kvarner",
    "Središnja Hrvatska",
    "Lika i Gorski kotar",
    "Međimurje i Zagorje"
  ];
  for (const [sortOrder, name] of regions.entries()) {
    await prisma.region.upsert({
      where: { slug: slug(name) },
      update: { name, sortOrder },
      create: { name, slug: slug(name), sortOrder }
    });
  }

  const slavonija = await prisma.region.findUniqueOrThrow({ where: { slug: "slavonija-i-baranja" } });
  const zagrebRegion = await prisma.region.findUniqueOrThrow({ where: { slug: "zagreb-i-okolica" } });
  const countyRows = [
    ["Osječko-baranjska", "osjecko-baranjska", slavonija.id],
    ["Vukovarsko-srijemska", "vukovarsko-srijemska", slavonija.id],
    ["Brodsko-posavska", "brodsko-posavska", slavonija.id],
    ["Požeško-slavonska", "pozesko-slavonska", slavonija.id],
    ["Virovitičko-podravska", "viroviticko-podravska", slavonija.id],
    ["Grad Zagreb", "grad-zagreb", zagrebRegion.id]
  ] as const;
  for (const [name, countySlug, regionId] of countyRows) {
    await prisma.county.upsert({
      where: { slug: countySlug },
      update: { name, regionId },
      create: { name, slug: countySlug, regionId }
    });
  }

  const osCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "osjecko-baranjska" } });
  const vuCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "vukovarsko-srijemska" } });
  const bpCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "brodsko-posavska" } });
  const psCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "pozesko-slavonska" } });
  const vpCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "viroviticko-podravska" } });
  const zgCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "grad-zagreb" } });
  const cities = [
    ["Osijek", osCounty.id, 45.555, 18.695],
    ["Zagreb", zgCounty.id, 45.815, 15.982],
    ["Đakovo", osCounty.id, 45.309, 18.410],
    ["Vukovar", vuCounty.id, 45.351, 19.003],
    ["Vinkovci", vuCounty.id, 45.288, 18.804],
    ["Našice", osCounty.id, 45.488, 18.087],
    ["Valpovo", osCounty.id, 45.660, 18.418],
    ["Beli Manastir", osCounty.id, 45.771, 18.603],
    ["Donji Miholjac", osCounty.id, 45.761, 18.167],
    ["Erdut", osCounty.id, 45.526, 19.061],
    ["Čepin", osCounty.id, 45.523, 18.563],
    ["Belišće", osCounty.id, 45.681, 18.405],
    ["Darda", osCounty.id, 45.628, 18.699],
    ["Bilje", osCounty.id, 45.607, 18.744],
    ["Bizovac", osCounty.id, 45.592, 18.458],
    ["Kneževi Vinogradi", osCounty.id, 45.750, 18.733],
    ["Batina", osCounty.id, 45.850, 18.850],
    ["Aljmaš", osCounty.id, 45.530, 18.950],
    ["Petrijevci", osCounty.id, 45.612, 18.535],
    ["Sarvaš", osCounty.id, 45.534, 18.837],
    ["Tenja", osCounty.id, 45.498, 18.747],
    ["Antunovac", osCounty.id, 45.490, 18.676],
    ["Višnjevac", osCounty.id, 45.568, 18.613],
    ["Karanac", osCounty.id, 45.760, 18.684],
    ["Zmajevac", osCounty.id, 45.801, 18.804],
    ["Ilok", vuCounty.id, 45.222, 19.376],
    ["Županja", vuCounty.id, 45.077, 18.697],
    ["Otok", vuCounty.id, 45.146, 18.883],
    ["Tovarnik", vuCounty.id, 45.165, 19.153],
    ["Nuštar", vuCounty.id, 45.332, 18.842],
    ["Borovo", vuCounty.id, 45.376, 18.966],
    ["Slavonski Brod", bpCounty.id, 45.160, 18.015],
    ["Nova Gradiška", bpCounty.id, 45.256, 17.383],
    ["Slavonski Šamac", bpCounty.id, 45.066, 18.488],
    ["Požega", psCounty.id, 45.331, 17.674],
    ["Pakrac", psCounty.id, 45.436, 17.188],
    ["Lipik", psCounty.id, 45.412, 17.152],
    ["Pleternica", psCounty.id, 45.288, 17.806],
    ["Kutjevo", psCounty.id, 45.426, 17.883],
    ["Virovitica", vpCounty.id, 45.832, 17.383],
    ["Slatina", vpCounty.id, 45.704, 17.703],
    ["Orahovica", vpCounty.id, 45.541, 17.884],
    ["Pitomača", vpCounty.id, 45.950, 17.233]
  ] as const;
  for (const [name, countyId, lat, lng] of cities) {
    await prisma.city.upsert({
      where: { slug: slug(name) },
      update: { name, countyId, lat, lng },
      create: { name, slug: slug(name), countyId, lat, lng }
    });
  }

  // Upsert categories using explicit slugs as the stable key.
  // Old slugs "outdoor" and "kultura" are kept in the DB for backward compat;
  // new canonical slugs are added here.
  const categoryDefs = [
    { slug: "glazba",            name: "Glazba",             sortOrder: 0 },
    { slug: "festivali",         name: "Festivali",           sortOrder: 1 },
    { slug: "izlozbe",           name: "Izložbe",             sortOrder: 2 },
    { slug: "radionice",         name: "Radionice",           sortOrder: 3 },
    { slug: "djeca-i-obitelj",   name: "Djeca i obitelj",     sortOrder: 4 },
    { slug: "na-otvorenom",      name: "Na otvorenom",        sortOrder: 5 },
    { slug: "hrana-i-vino",      name: "Hrana i vino",        sortOrder: 6 },
    { slug: "sajmovi",           name: "Sajmovi",             sortOrder: 7 },
    { slug: "sport",             name: "Sport",               sortOrder: 8 },
    { slug: "tradicija-i-folklor", name: "Tradicija i folklor", sortOrder: 9 },
    { slug: "manifestacije",     name: "Manifestacije",       sortOrder: 10 },
    { slug: "nocni-zivot",       name: "Noćni život",         sortOrder: 11 },
    { slug: "edukacija",         name: "Edukacija",           sortOrder: 12 },
    { slug: "humanitarno",       name: "Humanitarno",         sortOrder: 13 },
    { slug: "udruge",            name: "Udruge",              sortOrder: 14 },
    { slug: "ostalo",            name: "Ostalo",              sortOrder: 15 },
  ];
  for (const cat of categoryDefs) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: cat,
    });
  }

  // Migrate old "outdoor" events → "na-otvorenom"
  const outdoorCat = await prisma.category.findUnique({ where: { slug: "outdoor" } });
  const naOtvorenomCat = await prisma.category.findUnique({ where: { slug: "na-otvorenom" } });
  if (outdoorCat && naOtvorenomCat) {
    await prisma.eventCategory.updateMany({
      where: { categoryId: outdoorCat.id },
      data: { categoryId: naOtvorenomCat.id },
    });
    await prisma.event.updateMany({
      where: { categoryId: outdoorCat.id },
      data: { categoryId: naOtvorenomCat.id },
    });
  }

  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: UserRole.ADMIN, name: "Admin" },
    create: { email: adminEmail, passwordHash: adminHash, role: UserRole.ADMIN, name: "Admin" }
  });

  if (!seedDemoData) return;

  const demoOrganizers = [
    { name: "Turistička zajednica Osijek", email: "info@tz-osijek.hr" },
    { name: "Kulturni centar Đakovo", email: "kultura@dakovo.hr" },
    { name: "Grad Vukovar", email: "kultura@vukovar.hr" },
    { name: "Vinkovačke jeseni d.o.o.", email: "info@vinkovacke-jeseni.hr" },
    { name: "Turistička zajednica Baranje", email: "info@tz-baranja.hr" },
    { name: "Valpovačko kulturno ljeto", email: "info@valpovo.hr" },
    { name: "Naša scena Našice", email: "kultura@nasice.hr" },
    { name: "Sport i rekreacija Slavonija", email: "info@sport-slavonija.hr" },
  ];
  for (const org of demoOrganizers) {
    await prisma.organizer.upsert({
      where: { slug: slug(org.name) },
      update: { name: org.name },
      create: { name: org.name, slug: slug(org.name), email: org.email, status: OrganizerStatus.VERIFIED }
    });
  }

  const cityRows = await prisma.city.findMany({ include: { county: { include: { region: true } } } });
  const categoryRows = await prisma.category.findMany();
  const organizerRows = await prisma.organizer.findMany();

  const cityByName = (name: string) => {
    const c = cityRows.find((r) => r.name === name);
    if (!c) throw new Error(`City not found: ${name}`);
    return c;
  };
  const catBySlug = (s: string) => {
    const c = categoryRows.find((r) => r.slug === s);
    if (!c) throw new Error(`Category not found: ${s}`);
    return c;
  };
  const orgByName = (name: string) => {
    const o = organizerRows.find((r) => r.name === name);
    if (!o) throw new Error(`Organizer not found: ${name}`);
    return o;
  };

  const baseDate = new Date();
  baseDate.setHours(18, 0, 0, 0);
  const d = (offsetDays: number, hour = 18) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + offsetDays);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  // categories: first slug is primary, rest are additional
  const demoEvents = [
    {
      title: "Baranjski gastro festival",
      city: "Beli Manastir",
      categories: ["hrana-i-vino", "tradicija-i-folklor", "manifestacije"],
      organizer: "Turistička zajednica Baranje",
      startsAt: d(4, 11), endsAt: d(5, 22),
      isFree: false, priceText: "8 EUR",
      description: "Domaći vinari, sirari i mesari na jednom mjestu — degustacija baranjskih specijaliteta uz tamburice i dobro raspoloženje.",
      shortDescription: "Degustacija baranjskih specijaliteta — vino, kobasice i domaći sir u centru Belog Manastira.",
      venue: "Trg slobode, Beli Manastir",
    },
    {
      title: "Radionica tradicijskog lonačarstva",
      city: "Đakovo",
      categories: ["radionice", "tradicija-i-folklor", "edukacija"],
      organizer: "Kulturni centar Đakovo",
      startsAt: d(5, 17), endsAt: d(5, 20),
      isFree: false, priceText: "15 EUR",
      description: "Naučite osnove lončarskog zanata u kreativnoj radionici pod vodstvom majstora iz Slavonije. Glina i alat osigurani, polaznici nose kući vlastiti rad.",
      shortDescription: "Dvosatna radionica za početnike — napravite vlastitu zdjelu uz vodstvo majstora lončara.",
      venue: "Kulturni centar Đakovo",
    },
    {
      title: "Etno večer u Kopačkom ritu",
      city: "Bilje",
      categories: ["na-otvorenom", "glazba", "tradicija-i-folklor"],
      organizer: "Turistička zajednica Baranje",
      startsAt: d(6, 19), endsAt: d(6, 23),
      isFree: true, priceText: null,
      description: "Glazbeni program uz prirodu Parka prirode Kopački rit — folklorne grupe i tamburaški sastavi sviraju na otvorenom uz vatru i zvijezde.",
      shortDescription: "Folklorni nastupi i tamburaška glazba na rubu Kopačkog rita. Besplatno i za cijelu obitelj.",
      venue: "Naturpark Kopački rit, Bilje",
    },
    {
      title: "Tamburaška večer u Iloku",
      city: "Ilok",
      categories: ["glazba", "tradicija-i-folklor"],
      organizer: "Grad Vukovar",
      startsAt: d(8, 20), endsAt: null,
      isFree: true, priceText: null,
      description: "Večer tamburaške glazbe u gradu vinara na obali Dunava. Nastupaju poznati sastavi iz Srijema i Slavonije, uz degustaciju lokalnih vina.",
      shortDescription: "Tamburaški koncerti na tvrđavskom platou u Iloku, uz Dunav i iločka vina.",
      venue: "Tvrđavski plato, Ilok",
    },
    {
      title: "Open air kino — Tvrđa ljeto",
      city: "Osijek",
      categories: ["izlozbe", "manifestacije", "djeca-i-obitelj"],
      organizer: "Turistička zajednica Osijek",
      startsAt: d(10, 21), endsAt: d(24, 23),
      isFree: true, priceText: null,
      description: "Ljetne filmske projekcije na tvrđavskom trgu svake srijede do kolovoza. Program uključuje domaće, europske i animirane filmove za djecu i odrasle.",
      shortDescription: "Besplatni open air filmovi na Tvrđi svake srijede — od animiranih za djecu do europskog art filma.",
      venue: "Tvrđa — Trg Sv. Trojstva, Osijek",
    },
    {
      title: "Sajam tradicijskog obrta — Naše, naše!",
      city: "Našice",
      categories: ["sajmovi", "tradicija-i-folklor", "djeca-i-obitelj"],
      organizer: "Naša scena Našice",
      startsAt: d(12, 9), endsAt: d(12, 20),
      isFree: true, priceText: null,
      description: "Izlagači iz cijele Slavonije donose ručno izrađene proizvode — od tekstila i čipke do keramike, drvenih predmeta i domaće hrane. Radionica za djecu uključena.",
      shortDescription: "Slavonski obrtnici i proizvođači na jednom trgu — ručni rad, domaće namirnice i radionice za djecu.",
      venue: "Trg dr. Franje Tuđmana, Našice",
    },
    {
      title: "Glazbena večer u dvorcu Pejačević",
      city: "Našice",
      categories: ["glazba", "izlozbe"],
      organizer: "Naša scena Našice",
      startsAt: d(13, 20), endsAt: null,
      isFree: false, priceText: "10 EUR",
      description: "Komorni koncerti u dvorištu baroknog dvorca Pejačević — klasična glazba i jazz u jedinstvenoj atmosferi slavonskog ladanjskog nasljeđa.",
      shortDescription: "Komorni koncerti klasike i jazza u dvorištu dvorca Pejačević. Ograničen broj mjesta.",
      venue: "Dvorac Pejačević, Našice",
    },
    {
      title: "Vukovar film festival",
      city: "Vukovar",
      categories: ["festivali", "izlozbe", "manifestacije"],
      organizer: "Grad Vukovar",
      startsAt: d(15, 18), endsAt: d(18, 23),
      isFree: false, priceText: "12 EUR",
      description: "Međunarodni filmski festival s naglaskom na miru, sjećanju i multikulturalnom dijalogu uz Dunav. Prikazuju se filmovi iz više od 20 zemalja.",
      shortDescription: "Filmski festival uz Dunav — međunarodne projekcije, diskusije i večernji program na otvorenom.",
      venue: "Vukovar — dvorišta i kulturni centri",
    },
    {
      title: "Obiteljski dan u Gradskom parku",
      city: "Osijek",
      categories: ["djeca-i-obitelj", "radionice", "na-otvorenom"],
      organizer: "Turistička zajednica Osijek",
      startsAt: d(16, 10), endsAt: d(16, 18),
      isFree: true, priceText: null,
      description: "Kreativne radionice, lov na blago i lutkarski nastup za djecu u Gradskom parku u Osijeku. Roditelji se odmaraju dok djeca uče i igraju.",
      shortDescription: "Besplatan obiteljski program u Gradskom parku — radionice, lutkari i lov na blago za djecu.",
      venue: "Gradski park, Osijek",
    },
    {
      title: "Maratonska staza uz Dunav",
      city: "Batina",
      categories: ["sport", "na-otvorenom"],
      organizer: "Sport i rekreacija Slavonija",
      startsAt: d(17, 8), endsAt: d(17, 14),
      isFree: false, priceText: "15 EUR",
      description: "Trčanje po maloj i velikoj stazi uz obalu Dunava s ciljem na rimskom lokalitetu u Batini. Kategorije za trkače svih razina, obiteljska šetnja po kratkoj stazi.",
      shortDescription: "Polumaraton i 5 km uz Dunav — trčanje po baranjskom krajoliku s okrepom i nagradama.",
      venue: "Batina — rimski lokalitet",
    },
    {
      title: "Festival vina — Kutjevačke klisurice",
      city: "Kutjevo",
      categories: ["hrana-i-vino", "festivali", "na-otvorenom"],
      organizer: "Valpovačko kulturno ljeto",
      startsAt: d(18, 11), endsAt: d(19, 20),
      isFree: false, priceText: "12 EUR",
      description: "Degustacijski maraton kroz podrume kutjevačkih vinogradara uz glazbeni program, lokalne delicije i vođene ture kroz klisuru. Ulaznica uključuje čašu i vodič.",
      shortDescription: "Dva dana degustacije kutjevačkih vina uz glazbu i ture kroz podrume i klisurice.",
      venue: "Kutjevo — stari podrum i klisurice",
    },
    {
      title: "Noć muzeja — Slavonija",
      city: "Osijek",
      categories: ["izlozbe", "manifestacije"],
      organizer: "Turistička zajednica Osijek",
      startsAt: d(20, 19), endsAt: d(20, 24),
      isFree: true, priceText: null,
      description: "Posebni postavi, vođeni obilasci i noćni program u muzejima, galerijama i dvorcu na Tvrđi. Muzej Slavonije otvara depo i prikazuje predmete koji inače nisu na stalnom postavu.",
      shortDescription: "Jedna noć, svi muzeji otvoreni — posebni postavi, depo Muzeja Slavonije i vođene ture po Tvrđi.",
      venue: "Tvrđa i grad Osijek",
    },
    {
      title: "Valpovačko ljeto — Program u dvoru",
      city: "Valpovo",
      categories: ["tradicija-i-folklor", "glazba", "manifestacije"],
      organizer: "Valpovačko kulturno ljeto",
      startsAt: d(22, 19), endsAt: d(23, 22),
      isFree: true, priceText: null,
      description: "Folklorni nastupi, tamburaška glazba i izložba starih fotografija u parku dvorca Normann u Valpovu. Dvoru je ovo ljetna pozornica — program teče dva dana.",
      shortDescription: "Dva večerna programa u parku dvorca Normann — folklor, tamburica i izložba valpovačke baštine.",
      venue: "Dvorac Normann, Valpovo",
    },
    {
      title: "Đakovački vez — Ljetni program",
      city: "Đakovo",
      categories: ["tradicija-i-folklor", "manifestacije", "izlozbe"],
      organizer: "Kulturni centar Đakovo",
      startsAt: d(25, 18), endsAt: d(26, 22),
      isFree: true, priceText: null,
      description: "Tradicijski program u predvečerje velikog jesenskog festivala — nastup folklornih društava iz cijele regije, izložba veza i domaća kuhinja na Strossmayerovom trgu.",
      shortDescription: "Folklorni nastupi i izložba slavonskog veza na trgu ispred katedrale u Đakovu.",
      venue: "Trg J. J. Strossmayera, Đakovo",
    },
    {
      title: "Vinkovačke jeseni — Glazbeno predvečerje",
      city: "Vinkovci",
      categories: ["glazba", "tradicija-i-folklor", "festivali"],
      organizer: "Vinkovačke jeseni d.o.o.",
      startsAt: d(28, 19), endsAt: null,
      isFree: false, priceText: "8 EUR",
      description: "Tamburaški koncerti i folklorni program najavljuju jesenski festival — nastupaju mještani i gosti iz regije na glavnom gradskom trgu uz kasnolje tne večeri.",
      shortDescription: "Glazbeno predvečerje Vinkovačkih jeseni — tamburica i folklor na gradskom trgu.",
      venue: "Trg bana Šokčevića, Vinkovci",
    },
  ];

  for (const [i, ev] of demoEvents.entries()) {
    const city = cityByName(ev.city);
    const primaryCat = catBySlug(ev.categories[0]);
    const organizer = orgByName(ev.organizer);
    const venueSlug = slug(ev.venue);
    const venue = await prisma.venue.upsert({
      where: { slug_cityId: { slug: venueSlug, cityId: city.id } },
      update: {},
      create: {
        name: ev.venue.split(",")[0].trim(),
        slug: venueSlug,
        cityId: city.id,
        address: ev.venue,
      }
    });

    const event = await prisma.event.upsert({
      where: { slug: slug(ev.title) },
      update: {},
      create: {
        title: ev.title,
        slug: slug(ev.title),
        description: ev.description,
        shortDescription: ev.shortDescription,
        status: i < 12 ? EventStatus.PUBLISHED : EventStatus.PENDING_REVIEW,
        organizerId: organizer.id,
        venueId: venue.id,
        cityId: city.id,
        countyId: city.countyId,
        regionId: city.county.regionId,
        categoryId: primaryCat.id,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        isAllDay: false,
        isFree: ev.isFree,
        priceText: ev.priceText,
        sourceType: EventSourceKind.IMPORTED,
        extractionConfidence: 0.9,
        publishedAt: i < 12 ? new Date() : null,
      }
    });

    // Upsert EventCategory rows for all categories
    for (const [catIdx, catSlug] of ev.categories.entries()) {
      const cat = catBySlug(catSlug);
      await prisma.eventCategory.upsert({
        where: { eventId_categoryId: { eventId: event.id, categoryId: cat.id } },
        update: { isPrimary: catIdx === 0 },
        create: { eventId: event.id, categoryId: cat.id, isPrimary: catIdx === 0, source: "SEED" },
      });
    }
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
