import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";

// Representative fixture for https://visitslavoniabaranja.com/event/dogadanja-koja-nam-slijede/
// Captures the page structure: events grouped by month, each with date, title, location, description
const VISIT_SLAVONIA_FIXTURE = `
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

describe("AiEventParserService", () => {
  let parser: AiEventParserService;

  beforeEach(() => {
    parser = new AiEventParserService();
  });

  it("parses deterministic structured text (single event)", async () => {
    const parsed = await parser.parse({
      rawText: "Naslov: Koncert\nDatum: 2026-07-10\nVrijeme: 20:00\nGrad: Osijek\nKategorija: Glazba\nLokacija: Tvrđa\nBesplatno",
    });
    expect(parsed.title).toBe("Koncert");
    expect(parsed.city).toBe("Osijek");
    expect(parsed.isFree).toBe(true);
    expect(parsed.missingFields).toEqual([]);
  });

  it("extracts multiple candidates from a multi-event source page", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_FIXTURE });
    expect(result.sourceType).toBe("batch");
    expect(result.candidates.length).toBeGreaterThanOrEqual(4);
  });

  it("preserves sourceUrl on every candidate", async () => {
    const sourceUrl = "https://visitslavoniabaranja.com/event/dogadanja-koja-nam-slijede/";
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_FIXTURE, sourceUrl });
    for (const c of result.candidates) {
      expect(c.sourceUrl).toBe(sourceUrl);
    }
  });

  it("extracts Osijek and other Slavonian cities from fixture", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_FIXTURE });
    const cities = result.candidates.map((c) => c.city).filter(Boolean);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities).toContain("Osijek");
  });

  it("detects free admission from besplatno keyword", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_FIXTURE });
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

  it("all batch candidates missing date/location have missingFields and are not auto-publishable", async () => {
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_FIXTURE });
    for (const candidate of result.candidates) {
      if (candidate.missingFields.includes("startsAt") || candidate.missingFields.includes("city")) {
        // These must not be directly publishable – missingFields must be non-empty
        expect(candidate.missingFields.length).toBeGreaterThan(0);
        // Confidence must be below auto-publish threshold
        expect(candidate.confidence).toBeLessThan(1.0);
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
    const result = await parser.parseBatch({ rawText: VISIT_SLAVONIA_FIXTURE });
    for (const c of result.candidates) {
      expect((c as any)._status).toBe("pending");
    }
  });
});
