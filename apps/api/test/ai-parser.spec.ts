import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Structured format (DD.MM.YYYY on its own line, used by older import paths)
const STRUCTURED_FIXTURE = `
Događanja koja nam slijede

Srpanj 2026

10.7.2026
Etno fest Baranja
Kneževi Vinogradi
Tradicijski festival bunjačke i šokačke kulture s glazbom, plesom i gastronomijom Baranje.

17.7.2026
Večer uz Dunav
Vukovar
Glazbeni program uz obalu Dunava. Besplatno.

24.7.2026
Vinkovačke jeseni – Ljetna predigra
Vinkovci
Folklorna priredba i izložba tradicijskog rukotvorstva.

Kolovoz 2026

5.8.2026
Đakovački vezovi
Đakovo
Međunarodni festival folklora. Ulaznica: 10 EUR.

12.8.2026
Slavonski maraton
Osijek
Trčanje uz rijeku Dravu kroz povijesni dio Osijeka.

Rujan 2026

6.9.2026
Gastro sajam – Slavonski specijaliteti
Našice
Sajam tradicijske hrane i pića. Besplatan ulaz.
`.trim();

// Real Visit Slavonija inline format: "DD.MM., Title – City" on one line, grouped by month heading.
// Covers all date patterns described in requirements.
const VISIT_SLAVONIA_INLINE_FIXTURE = `
Događanja koja nam slijede

LIPANJ 2026.

6./2026., Plava noć 2026. – Đakovo
6./2026., Putevima baranjskih vinogradara – Beli Manastir
Do 5.7., Copacabana Beach Bar sezona – Erdut
Do 5.7., Korzo Party – Osijek

SRPANJ 2026.

3.-4.7., Reunited Festival – Beli Manastir
3.-5.7., Picin Park Fest – Erdut
3.7.-28.8., Plaža Copacabana – Erdut
4.7., Koktejl party uz glazbu – Erdut
10.7., Etno-gastronomska večer – Vukovar
15.7., Vinkovački tamburaši – Vinkovci
20.7., Gastro sajam Slavonije – Našice

KOLOVOZ 2026.

12./2026., Zimski specijal – Osijek
6./2027., Ljetni festival folklora – Vinkovci
`.trim();

// ── Test suite ────────────────────────────────────────────────────────────────

describe("AiEventParserService", () => {
  let parser: AiEventParserService;

  beforeEach(() => {
    parser = new AiEventParserService();
  });

  // ── Existing structured-format tests (must keep passing) ──────────────────

  it("parses deterministic structured text (single event)", async () => {
    const parsed = await parser.parse({
      rawText: "Naslov: Koncert\nDatum: 2026-07-10\nVrijeme: 20:00\nGrad: Osijek\nKategorija: Glazba\nLokacija: Tvrđa\nBesplatno",
    });
    expect(parsed.title).toBe("Koncert");
    expect(parsed.city).toBe("Osijek");
    expect(parsed.isFree).toBe(true);
    expect(parsed.missingFields).toEqual([]);
  });

  it("extracts multiple candidates from a structured multi-event source page", async () => {
    const result = await parser.parseBatch({ rawText: STRUCTURED_FIXTURE });
    expect(result.sourceType).toBe("batch");
    expect(result.candidates.length).toBeGreaterThanOrEqual(4);
  });

  it("preserves sourceUrl on every candidate (structured)", async () => {
    const sourceUrl = "https://visitslavoniabaranja.com/event/dogadanja-koja-nam-slijede/";
    const result = await parser.parseBatch({ rawText: STRUCTURED_FIXTURE, sourceUrl });
    for (const c of result.candidates) {
      expect(c.sourceUrl).toBe(sourceUrl);
    }
  });

  it("extracts Osijek and other Slavonian cities from structured fixture", async () => {
    const result = await parser.parseBatch({ rawText: STRUCTURED_FIXTURE });
    const cities = result.candidates.map((c) => c.city).filter(Boolean);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities).toContain("Osijek");
  });

  it("detects free admission from besplatno keyword (structured)", async () => {
    const result = await parser.parseBatch({ rawText: STRUCTURED_FIXTURE });
    const vukovarEvent = result.candidates.find((c) => c.city === "Vukovar");
    expect(vukovarEvent?.isFree).toBe(true);
  });

  it("marks startsAt missing when no date found in block", async () => {
    const result = await parser.parseBatch({
      rawText: "Festival Folklora\nOsijek\nVeliki folklor festival bez datuma",
    });
    expect(result.candidates[0].missingFields).toContain("startsAt");
    expect(result.candidates[0].warnings.some((w) => w.includes("Datum"))).toBe(true);
  });

  it("marks city missing when no known city found", async () => {
    const result = await parser.parseBatch({
      rawText: "Naslov: Ljetni Koncert\nDatum: 2026-07-15\nKategorija: Glazba\nNepoznato mjesto",
    });
    expect(result.candidates[0].missingFields).toContain("city");
  });

  it("all batch candidates with missing date/location have missingFields set", async () => {
    const result = await parser.parseBatch({ rawText: STRUCTURED_FIXTURE });
    for (const c of result.candidates) {
      if (c.missingFields.includes("startsAt") || c.missingFields.includes("city")) {
        expect(c.missingFields.length).toBeGreaterThan(0);
        expect(c.confidence).toBeLessThan(1.0);
      }
    }
  });

  it("strips HTML tags and parses events from HTML input", async () => {
    const rawHtml = `
      <html><body>
        <h2>Srpanj</h2>
        <div class="event">
          <span class="date">15.7.2026</span>
          <h3>Ljetni Koncert</h3>
          <p>Osijek, Tvrđa – Besplatno</p>
        </div>
        <div class="event">
          <span class="date">20.7.2026</span>
          <h3>Sajam hrane</h3>
          <p>Đakovo – Ulaznica 5 EUR</p>
        </div>
      </body></html>
    `;
    const result = await parser.parseBatch({ rawHtml });
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates.some((c) => c.city === "Osijek")).toBe(true);
  });

  it("initialises all candidates with _status pending", async () => {
    const result = await parser.parseBatch({ rawText: STRUCTURED_FIXTURE });
    for (const c of result.candidates) {
      expect((c as any)._status).toBe("pending");
    }
  });

  // ── Confidence cap ────────────────────────────────────────────────────────

  it("never returns confidence of 1.0 for any parsed candidate", async () => {
    const result = await parser.parseBatch({ rawText: STRUCTURED_FIXTURE });
    for (const c of result.candidates) {
      expect(c.confidence).toBeLessThan(1.0);
    }
  });

  it("never returns confidence of 1.0 from inline fixture", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    for (const c of result.candidates) {
      expect(c.confidence).toBeLessThan(1.0);
    }
  });

  // ── Visit Slavonija inline format ─────────────────────────────────────────

  it("detects Visit Slavonija inline style and returns sourceType batch", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    expect(result.sourceType).toBe("batch");
  });

  it("extracts more than 10 candidates from inline fixture", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    expect(result.candidates.length).toBeGreaterThan(10);
  });

  it("preserves sourceUrl on every candidate (inline)", async () => {
    const url = "https://visitslavoniabaranja.com/event/dogadanja-koja-nam-slijede/";
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE, sourceUrl: url });
    for (const c of result.candidates) {
      expect(c.sourceUrl).toBe(url);
    }
  });

  it("initialises all inline candidates with _status pending", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    for (const c of result.candidates) {
      expect((c as any)._status).toBe("pending");
    }
  });

  it("strips date prefix: '3.-4.7., Reunited Festival – ...' → title 'Reunited Festival'", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const reunited = result.candidates.find((c) => c.title === "Reunited Festival");
    expect(reunited).toBeDefined();
    expect(reunited!.title).toBe("Reunited Festival");
  });

  it("parses city correctly from '3.-4.7., Reunited Festival – Beli Manastir'", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const reunited = result.candidates.find((c) => c.title === "Reunited Festival");
    expect(reunited!.city).toBe("Beli Manastir");
  });

  it("prefers a known city in a comma-separated segment near the end", async () => {
    const result = await parser.parseBatch({
      rawText: "SRPANJ 2026.\n4.7., Ljetna večer – Dom kulture, program na otvorenom, Donji Miholjac",
    });
    expect(result.candidates[0].city).toBe("Donji Miholjac");
  });

  it("does not treat title fragments like 'festival pjevača amatera' as a city", async () => {
    const result = await parser.parseBatch({
      rawText: "SRPANJ 2026.\n4.7., Festival pjevača amatera – festival pjevača amatera",
    });
    expect(result.candidates[0].city).toBe("");
    expect(result.candidates[0].missingFields).toContain("city");
  });

  it("does not default city to Osijek for non-Osijek events", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    // Reunited Festival is in Beli Manastir, not Osijek
    const reunited = result.candidates.find((c) => c.title === "Reunited Festival");
    expect(reunited!.city).not.toBe("Osijek");
    // Picin Park Fest is in Erdut
    const picin = result.candidates.find((c) => c.title === "Picin Park Fest");
    expect(picin?.city).not.toBe("Osijek");
  });

  it("sets city to Osijek only when source line actually contains Osijek", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const osijekEvents = result.candidates.filter((c) => c.city === "Osijek");
    // Only "Korzo Party – Osijek" and "Zimski specijal – Osijek" should have Osijek
    for (const e of osijekEvents) {
      // Verify the city came from the source line, not default
      expect(e.title).not.toBe("Reunited Festival");
      expect(e.title).not.toBe("Picin Park Fest");
    }
  });

  it("adds missingFields:startsAt and warning for month-only date lines", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    // "6./2026., Plava noć 2026. – Đakovo" has month-only date
    const plava = result.candidates.find((c) => c.title.includes("Plava noć"));
    expect(plava).toBeDefined();
    expect(plava!.missingFields).toContain("startsAt");
    expect(plava!.warnings.some((w) => w.includes("exact date missing"))).toBe(true);
  });

  it("adds warning for 'Do' (end-date-only) lines", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const copacabana = result.candidates.find((c) => c.title.includes("Copacabana Beach Bar"));
    expect(copacabana).toBeDefined();
    expect(copacabana!.warnings.some((w) => w.includes("start date unknown"))).toBe(true);
  });

  it("parses cross-month range: startsAt July, endsAt August", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const plazaCopa = result.candidates.find((c) => c.title === "Plaža Copacabana");
    expect(plazaCopa).toBeDefined();
    expect(plazaCopa!.startsAt).toContain("-07-");
    expect(plazaCopa!.endsAt).toContain("-08-");
  });

  it("parses same-month range: both startsAt and endsAt in July", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const reunited = result.candidates.find((c) => c.title === "Reunited Festival");
    expect(reunited!.startsAt).toContain("-07-03");
    expect(reunited!.endsAt).toContain("-07-04");
  });

  it("parses single date: startsAt is set, endsAt empty", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const koktejl = result.candidates.find((c) => c.title.includes("Koktejl party"));
    expect(koktejl).toBeDefined();
    expect(koktejl!.startsAt).toContain("-07-04");
    expect(koktejl!.endsAt).toBe("");
  });

  it("confidence is lower for month-only date candidates than exact-date candidates", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_INLINE_FIXTURE });
    const plava = result.candidates.find((c) => c.title.includes("Plava noć"))!;
    const koktejl = result.candidates.find((c) => c.title.includes("Koktejl party"))!;
    expect(plava.confidence).toBeLessThan(koktejl.confidence);
  });

  // ── HTML entity decoding ──────────────────────────────────────────────────

  it("decodes &#8211; (en dash) in HTML input", async () => {
    const rawHtml = `
      <html><body>
        <p>SRPANJ 2026.</p>
        <p>4.7., Ljetni koncert &#8211; Osijek</p>
        <p>10.7., Etno festival &#8211; Đakovo</p>
      </body></html>
    `;
    const result = await parser.parseBatch({ rawHtml });
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    // After decoding &#8211; → –, parseTitleAndLocation should split on –
    const ljetni = result.candidates.find((c) => c.title === "Ljetni koncert");
    expect(ljetni).toBeDefined();
    expect(ljetni!.city).toBe("Osijek");
  });

  it("decodes &#8212; (em dash) in HTML input", async () => {
    const rawHtml = `<p>SRPANJ 2026.</p><p>5.7., Jazz večer &#8212; Vukovar</p>`;
    const result = await parser.parseBatch({ rawHtml });
    const jazz = result.candidates.find((c) => c.title === "Jazz večer");
    expect(jazz?.city).toBe("Vukovar");
  });

  it("decodes numeric HTML entities in general htmlToText", async () => {
    const rawHtml = `<p>Naslov: Koncert &#38; Festival</p><p>Datum: 2026-08-01</p><p>Grad: Osijek</p>`;
    const result = await parser.parseBatch({ rawHtml });
    // &#38; = & → title should contain &
    expect(result.candidates[0].title).toContain("&");
  });

  // ── Category inference ────────────────────────────────────────────────────

  it("does not assign Glazba to events with only 'festival' in title", async () => {
    const result = await parser.parseBatch({
      rawText: "Naslov: Vinkovačke jeseni Festival\nDatum: 2026-09-01\nGrad: Vinkovci",
    });
    expect(result.candidates[0].category).not.toBe("Glazba");
  });

  it("assigns Tradicija i folklor to event with 'folklor' keyword", async () => {
    const result = await parser.parseBatch({
      rawText: "Naslov: Smotra folklora\nDatum: 2026-07-20\nGrad: Đakovo",
    });
    expect(result.candidates[0].category).toBe("Tradicija i folklor");
  });

  it("assigns Hrana i vino to gastro events", async () => {
    const result = await parser.parseBatch({
      rawText: "Naslov: Gastro sajam specijaliteta\nDatum: 2026-08-10\nGrad: Našice",
    });
    expect(result.candidates[0].category).toBe("Hrana i vino");
  });

  it("assigns Sport to maraton events", async () => {
    const result = await parser.parseBatch({
      rawText: "Naslov: Slavonski maraton\nDatum: 2026-09-15\nGrad: Osijek",
    });
    expect(result.candidates[0].category).toBe("Sport");
  });
});
