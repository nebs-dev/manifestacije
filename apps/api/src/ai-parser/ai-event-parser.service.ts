import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";

export type ParsedEventCandidate = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean;
  venueName: string;
  address: string;
  lat?: number;
  lng?: number;
  city: string;
  county: string;
  region: string;
  category: string;
  isFree: boolean | null;
  priceText: string;
  ticketUrl: string;
  sourceUrl: string;
  organizerName: string;
  imageUrl: string;
  imageCredit?: string;
  imageSourceUrl?: string;
  confidence: number;
  missingFields: string[];
  warnings: string[];
};

export type ParsedSourceResult = {
  sourceUrl: string;
  sourceType: "batch" | "single";
  candidates: (ParsedEventCandidate & { _status?: "pending" | "created" | "ignored"; _eventId?: number })[];
};

// Backward-compatible alias
export type ParsedEvent = ParsedEventCandidate;

type Candidate = ParsedEventCandidate & { _status: "pending" };

@Injectable()
export class AiEventParserService {
  private readonly KNOWN_CITIES = [
    "Osijek", "Zagreb", "Đakovo", "Vukovar", "Vinkovci", "Našice", "Valpovo", "Beli Manastir",
    "Slavonski Brod", "Požega", "Virovitica", "Koprivnica", "Čakovec", "Kneževi Vinogradi",
    "Donji Miholjac", "Erdut", "Čepin", "Cepin", "Belišće", "Belisce", "Darda", "Bilje",
    "Bizovac", "Kneževi Vinogradi", "Knezevi Vinogradi", "Batina", "Aljmaš", "Aljmas",
    "Petrijevci", "Sarvaš", "Sarvas", "Tenja", "Antunovac", "Višnjevac", "Visnjevac",
    "Josipovac", "Semeljci", "Satnica Đakovačka", "Satnica Dakovacka", "Đurđenovac",
    "Durdjenovac", "Feričanci", "Fericanci", "Podgorač", "Podgorac", "Koška", "Koska",
    "Punitovci", "Gorjani", "Levanjska Varoš", "Levanjska Varos", "Trnava", "Draž",
    "Draz", "Jagodnjak", "Popovac", "Karanac", "Zmajevac", "Suza", "Lug", "Topolje",
    "Sombor", "Ilok", "Županja", "Zupanja", "Otok", "Nijemci", "Tovarnik", "Lovas",
    "Nuštar", "Nustar", "Borovo", "Jarmina", "Vođinci", "Vodinci", "Stari Mikanovci",
    "Slavonski Šamac", "Slavonski Samac", "Vrpolje", "Garčin", "Garcin", "Oriovac",
    "Nova Gradiška", "Nova Gradiska", "Pakrac", "Lipik", "Pleternica", "Kutjevo",
    "Velika", "Orahovica", "Slatina", "Pitomača", "Pitomaca",
    "Split", "Rijeka", "Zadar", "Šibenik", "Dubrovnik", "Pula", "Varaždin", "Karlovac",
    "Sisak", "Bjelovar", "Gospić", "Krapina", "Pazin",
  ];

  private readonly MONTH_NUMBERS: Record<string, number> = {
    "siječanj": 1, "sijecanj": 1,
    "veljača": 2, "veljaca": 2,
    "ožujak": 3, "ozujak": 3,
    "travanj": 4,
    "svibanj": 5,
    "lipanj": 6,
    "srpanj": 7,
    "kolovoz": 8,
    "rujan": 9,
    "listopad": 10,
    "studeni": 11,
    "prosinac": 12,
  };

  // Values are backend slugs. More specific categories listed before catch-alls.
  private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
    "tradicija-i-folklor": ["folklor", "tradicija", "etno", "narodni", "folklorni", "vez", "vezovi", "advent", "dani grada", "dani op"],
    "festivali":           ["festival", "fest"],
    "manifestacije":       ["manifestacij", "priredba", "doček", "svečanost"],
    "glazba":              ["koncert", "glazba", "music", "zbor", "orkestar", "pjevanje", "nastup", "tambur", "klapa", "dj set"],
    "hrana-i-vino":        ["hrana", "vino", "wine", "kulinarstvo", "gastronomija", "pivnica", "kuhanje", "gastro", "degustacij", "specijalitet", "fišijada", "kulen", "craft beer"],
    "izlozbe":             ["izložba", "galerija", "muzej", "kazalište", "predstava", "film", "kulturni", "kino"],
    "djeca-i-obitelj":     ["djeca", "obitelj", "kids", "family", "dječji", "za djecu"],
    "sport":               ["sport", "trčanje", "maraton", "natjecanje", "turnir", "liga", "utrka", "bike", "bicikl", "trail", "plivanje"],
    "na-otvorenom":        ["outdoor", "hiking", "planina", "šetnja", "rafting", "priroda", "na otvorenom"],
    "radionice":           ["radionica", "workshop", "tečaj"],
    "edukacija":           ["seminar", "predavanje", "edukacij"],
    "sajmovi":             ["sajam", "market", "tržnica", "vašar"],
    "humanitarno":         ["humanitarn", "dobrotvorn", "donacij"],
    "nocni-zivot":         ["party", "klub", "noćni život", "night"],
    "ostalo":              [],
  };

  // ── Public API ────────────────────────────────────────────────────────────────

  extractEventSubLinks(html: string, baseUrl: string): string[] {
    let base: URL;
    try { base = new URL(baseUrl); } catch { return []; }

    const seen = new Set<string>();
    const allLinks: string[] = [];
    const hrefRe = /href=["']([^"'#][^"']*?)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
      try {
        const url = new URL(m[1].trim(), baseUrl);
        if (url.hostname !== base.hostname) continue;
        const path = url.pathname;
        if (path === "/" || path === base.pathname || path.length < 5) continue;
        if (/\/(kontakt|o-nama|naslovnica|pocetna|home|about|contact|admin|login|prijava|registracija|search|tag|kategorija|rss|sitemap)\/?$/i.test(path)) continue;
        if (/\.(pdf|doc|docx|xls|jpg|jpeg|png|gif|zip|mp3|mp4)\b/i.test(path)) continue;
        const full = url.origin + path;
        if (!seen.has(full)) { seen.add(full); allLinks.push(full); }
      } catch { /* skip */ }
    }

    // Only return links that share a parent path with 3+ siblings (structured listing)
    const byParent = new Map<string, string[]>();
    for (const link of allLinks) {
      try {
        const parts = new URL(link).pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const parent = parts.slice(0, -1).join("/");
          const arr = byParent.get(parent) ?? [];
          arr.push(link);
          byParent.set(parent, arr);
        }
      } catch { /* skip */ }
    }

    const result: string[] = [];
    for (const [, siblings] of byParent) {
      if (siblings.length >= 3) result.push(...siblings);
    }
    return [...new Set(result)];
  }

  async crawlListingSubPages(html: string, baseUrl: string): Promise<{
    subTexts: string[];
    totalFound: number;
    fetched: number;
  }> {
    const MAX = 10;
    const links = this.extractEventSubLinks(html, baseUrl);
    if (links.length < 3) return { subTexts: [], totalFound: 0, fetched: 0 };

    const toFetch = links.slice(0, MAX);
    const results = await Promise.allSettled(
      toFetch.map(async (url) => {
        const res = await fetch(url, {
          headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return "";
        return this.htmlToText(await res.text()).slice(0, 2000);
      })
    );

    const subTexts = results
      .map((r, i) => r.status === "fulfilled" && r.value ? `[${toFetch[i]}]\n${r.value}` : "")
      .filter(Boolean);

    return { subTexts, totalFound: links.length, fetched: subTexts.length };
  }

  async parseBatch(input: {
    rawText?: string;
    rawHtml?: string;
    sourceUrl?: string;
    organizerName?: string;
  }): Promise<ParsedSourceResult> {
    const htmlImageUrl = input.rawHtml ? this.extractHtmlImage(input.rawHtml, input.sourceUrl) : "";
    const raw = input.rawHtml ? this.htmlToText(input.rawHtml) : (input.rawText ?? "");
    // Normalize: trim each line so leading whitespace from HTML conversion doesn't break detection
    const text = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).join("\n");
    const sourceUrl = input.sourceUrl ?? "";

    if (this.isVisitSlavoniaStyle(text)) {
      const result = this.parseVisitSlavoniaLines(text, sourceUrl);
      return { ...result, candidates: result.candidates.map((c) => this.withFallbackImage(c, htmlImageUrl, sourceUrl)) };
    }

    const blocks = this.splitIntoEventBlocks(text);
    const candidates = blocks.map((b) => this.withFallbackImage(this.parseBlock(b, sourceUrl, input.organizerName), htmlImageUrl, sourceUrl));
    return { sourceUrl, sourceType: candidates.length > 1 ? "batch" : "single", candidates };
  }

  async parse(input: { rawText?: string; rawHtml?: string; sourceUrl?: string; organizerName?: string }): Promise<ParsedEvent> {
    const result = await this.parseBatch(input);
    return result.candidates[0] ?? this.emptyCandidate(input.sourceUrl ?? "");
  }

  async parseBatchWithLlm(input: {
    rawText?: string;
    rawHtml?: string;
    sourceUrl?: string;
    screenshotBase64?: string;
    screenshotMediaType?: string;
    contextHint?: string;
  }): Promise<ParsedSourceResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY nije postavljen u .env");

    const sourceUrl = input.sourceUrl ?? "";

    // Facebook URL without screenshot — return helpful warning
    if (this.isFacebookUrl(sourceUrl) && !input.screenshotBase64 && !input.rawText?.trim() && !input.rawHtml?.trim()) {
      const candidate = this.emptyCandidate(sourceUrl);
      candidate.warnings.push(
        "Facebook blokira automatsko dohvaćanje. Kopiraj tekst događanja s Facebook stranice i zalijepi ga u 'Ručni unos' s uključenim AI parserom, ili uploadaj screenshot."
      );
      candidate.confidence = 0;
      return { sourceUrl, sourceType: "single", candidates: [{ ...candidate, _status: "pending" }] };
    }

    const htmlImageUrl = input.rawHtml ? this.extractHtmlImage(input.rawHtml, sourceUrl) : "";
    const htmlText = input.rawHtml ? this.htmlToText(input.rawHtml) : "";
    const combined = [htmlText, input.rawText ?? ""].filter(Boolean).join("\n\n---\n\n");
    const text = combined.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).join("\n");
    const isScreenshot = Boolean(input.screenshotBase64);
    const charLimit = isScreenshot ? 12000 : 24000;
    const truncated = text.length > charLimit ? text.slice(0, charLimit) + "\n[sadržaj skraćen]" : text;

    const eventSchema = `{
  "title": "string",
  "description": "string",
  "startsAt": "2026-07-15T20:00:00+02:00",
  "endsAt": "2026-07-15T23:00:00+02:00 ili null",
  "isAllDay": false,
  "venueName": "string",
  "city": "string (ime grada na hrvatskom)",
  "category": "jedna-od-16-kategorija",
  "isFree": true/false/null,
  "priceText": "string ili ''",
  "ticketUrl": "string ili ''",
  "organizerName": "string ili ''",
  "imageUrl": "string ili ''",
  "confidence": 0.85,
  "missingFields": ["title","startsAt","city","category — samo ova 4 ako nedostaju"],
  "warnings": ["samo stvarni problemi"]
}`;

    const systemPrompt = `Ti si ekstraktor podataka o događanjima za hrvatsku platformu Manifestacije.hr.
Vrati ISKLJUČIVO validan JSON bez markdown formatiranja.

Kategorija mora biti TOČNO jedna od: glazba, festivali, izlozbe, radionice, djeca-i-obitelj, hrana-i-vino, sajmovi, sport, tradicija-i-folklor, manifestacije, nocni-zivot, edukacija, humanitarno, udruge, na-otvorenom, ostalo

Mapiranje Facebook kategorija u naše:
- "Music & audio", "Concerts & Live Music" → glazba
- "Nightlife" → nocni-zivot
- "Festivals" → festivali
- "Arts", "Visual Arts", "Film", "Exhibition" → izlozbe
- "Workshops", "Classes" → radionice
- "Food & Drink", "Food" → hrana-i-vino
- "Sports & Fitness" → sport
- "Family", "Children" → djeca-i-obitelj
- "Education", "Science" → edukacija
- "Community", "Causes", "Fundraiser" → humanitarno
- "Outdoor" → na-otvorenom

Datumi i vremena u ISO 8601 formatu, vremenska zona Europe/Zagreb (UTC+2).
Hrvatsko pisanje vremena: "21.00", "20.00", "19.00", "18.00" su sati i minute (ne decimalni brojevi) — mapirati u T21:00:00+02:00, T20:00:00+02:00 itd.
Ako datum nema godinu, pretpostavi tekuću godinu (2026).

Ako grad nije eksplicitno napisan uz svaki događaj, zaključi iz konteksta: naziva festivala, organizatora ili poznatih lokacija (npr. "Dvorana Franjo Krežma", "Trg Vatroslava Lisinskog", "Galerija KCO", "Dvorište PTFOS" → Osijek). Ako je na screenshotu naveden grad ili festival koji se održava u jednom gradu, primijeni taj grad na sve događaje.

Ako nešto ne možeš pronaći, koristi prazan string ili null.
OBAVEZNA polja (jedino ova idu u missingFields): title, startsAt, city, category.
OPCIONALNA polja — nikad ne stavljaj u missingFields: endsAt, priceText, imageUrl, ticketUrl, venueName, organizerName.
Warnings koristi samo za stvarne probleme (datum u prošlosti, nevažeći URL i sl.).

AKO SADRŽAJ SADRŽI JEDAN DOGAĐAJ — vrati jedan JSON objekt:
${eventSchema}

AKO SADRŽAJ SADRŽI LISTING VIŠE DOGAĐAJA — vrati JSON s poljem "candidates":
{
  "candidates": [
    ${eventSchema},
    ${eventSchema}
  ]
}
Iz listinga izvuci SVE događaje koje možeš identificirati (do 50). Ne preskači događaje zbog nedostatka opisa — kratki unosi su OK.`;

    const userContent: (ImageBlockParam | TextBlockParam)[] = [];
    if (input.screenshotBase64) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: (input.screenshotMediaType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: input.screenshotBase64,
        },
      });
    }
    const textPrompt = input.screenshotBase64
      ? `Izvuci sve događaje s ovog screenshota. Može biti jedan događaj ili lista više događaja — vrati sve što vidiš (do 50).${sourceUrl ? ` URL: ${sourceUrl}` : ""}${input.contextHint ? `\nKontekst: ${input.contextHint}` : ""}${truncated ? `\n\nDodatni tekst:\n${truncated}` : ""}`
      : `URL stranice: ${sourceUrl}${input.contextHint ? `\nKontekst: ${input.contextHint}` : ""}\n\nSadržaj stranice:\n${truncated}`;
    userContent.push({ type: "text", text: textPrompt });

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: userContent,
      }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Neočekivani odgovor od Claude API-ja");

    let rawParsed: unknown;
    try {
      const jsonText = content.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      rawParsed = JSON.parse(jsonText);
    } catch {
      throw new Error(`Claude nije vratio validan JSON: ${content.text.slice(0, 200)}`);
    }

    const normalize = (p: Partial<ParsedEventCandidate>): ParsedEventCandidate => ({
      title: p.title ?? "",
      description: p.description ?? "",
      startsAt: p.startsAt ?? "",
      endsAt: p.endsAt ?? "",
      isAllDay: p.isAllDay ?? false,
      venueName: p.venueName ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      county: p.county ?? "",
      region: p.region ?? "",
      category: p.category ?? "ostalo",
      isFree: p.isFree ?? null,
      priceText: p.priceText ?? "",
      ticketUrl: p.ticketUrl ?? "",
      sourceUrl,
      organizerName: p.organizerName ?? "",
      imageUrl: p.imageUrl || htmlImageUrl,
      imageCredit: p.imageCredit,
      imageSourceUrl: p.imageSourceUrl,
      confidence: p.confidence ?? 0.7,
      missingFields: p.missingFields ?? [],
      warnings: p.warnings ?? [],
    });

    const asBatch = rawParsed && typeof rawParsed === "object" && "candidates" in (rawParsed as object)
      && Array.isArray((rawParsed as { candidates: unknown }).candidates);

    if (asBatch) {
      const { candidates: raw } = rawParsed as { candidates: Partial<ParsedEventCandidate>[] };
      const candidates = raw.map((c) => ({ ...normalize(c), _status: "pending" as const }));
      return { sourceUrl, sourceType: "batch", candidates };
    }

    return {
      sourceUrl,
      sourceType: "single",
      candidates: [{ ...normalize(rawParsed as Partial<ParsedEventCandidate>), _status: "pending" }],
    };
  }

  private isFacebookUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      return hostname === "fb.me" || hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    }
    catch { return false; }
  }

  // ── HTML normalisation ────────────────────────────────────────────────────────

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      // Named entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Numeric entities (covers &#8211; → –, &#8212; → —, etc.)
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
      .replace(/[^\S\n]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private extractHtmlImage(html: string, sourceUrl?: string): string {
    const match = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    const image = match?.[1]?.trim();
    if (!image) return "";
    try {
      return sourceUrl ? new URL(image, sourceUrl).toString() : image;
    } catch {
      return image;
    }
  }

  private withFallbackImage(candidate: ParsedEventCandidate & { _status?: "pending" | "created" | "ignored"; _eventId?: number }, imageUrl: string, sourceUrl: string) {
    if (!imageUrl || candidate.imageUrl) return candidate;
    return { ...candidate, imageUrl, imageSourceUrl: sourceUrl };
  }

  // ── Visit Slavonija inline-list parser ────────────────────────────────────────
  //
  // Format:
  //   LIPANJ 2026.
  //   6./2026., Event – City
  //   Do 5.7., Event – City
  //   SRPANJ 2026.
  //   3.-4.7., Reunited Festival – Beli Manastir
  //   3.7.-28.8., Plaža Copacabana – Erdut
  //   4.7., Event – City

  private isVisitSlavoniaStyle(text: string): boolean {
    const hasMonthHeading =
      /^(siječanj|veljača|ožujak|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac)\s+20\d{2}/im.test(text);
    const hasInlineDate =
      /^\d{1,2}\.\d{1,2}\.,/m.test(text) ||
      /^\d{1,2}\.-\d{1,2}\.\d{1,2}\.,/m.test(text) ||
      /^\d{1,2}\.\d{1,2}\.-\d{1,2}\.\d{1,2}\.,/m.test(text) ||
      /^[Dd]o\s+\d{1,2}\.\d{1,2}\.,/m.test(text) ||
      /^\d{1,2}\.\/\d{4}\./m.test(text);
    return hasMonthHeading && hasInlineDate;
  }

  private parseVisitSlavoniaLines(text: string, sourceUrl: string): ParsedSourceResult {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const candidates: Candidate[] = [];
    let currentYear = new Date().getFullYear();
    let currentMonth = 0;

    for (const line of lines) {
      const heading = this.parseMonthHeading(line);
      if (heading) {
        currentMonth = heading.month;
        currentYear = heading.year;
        continue;
      }
      const c = this.parseVisitSlavoniaLine(line, currentYear, currentMonth, sourceUrl);
      if (c) candidates.push(c);
    }

    return { sourceUrl, sourceType: candidates.length > 1 ? "batch" : "single", candidates };
  }

  private parseMonthHeading(line: string): { month: number; year: number } | null {
    const m = line.match(
      /^(siječanj|veljača|ožujak|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac)\.?\s+(20\d{2})/i,
    );
    if (!m) return null;
    const month = this.MONTH_NUMBERS[m[1].toLowerCase()] ?? 0;
    return month > 0 ? { month, year: parseInt(m[2], 10) } : null;
  }

  private parseVisitSlavoniaLine(
    line: string,
    year: number,
    month: number,
    sourceUrl: string,
  ): Candidate | null {
    let rest = "";
    let startsAt = "";
    let endsAt = "";
    let isMonthOnly = false;
    const warnings: string[] = [];
    let m: RegExpMatchArray | null;

    // 1. Month/year only: "6./2026., Title"
    m = line.match(/^(\d{1,2})\.\/(\d{4})\.?,\s+(.+)$/);
    if (m) {
      isMonthOnly = true;
      warnings.push("Only month/year provided; exact date missing.");
      rest = m[3];
    }

    // 2. Cross-month range: "3.7.-28.8., Title"
    if (!rest) {
      m = line.match(/^(\d{1,2})\.(\d{1,2})\.-(\d{1,2})\.(\d{1,2})\.?,\s+(.+)$/);
      if (m) {
        startsAt = this.buildDate(year, parseInt(m[2], 10), parseInt(m[1], 10));
        endsAt = this.buildDate(year, parseInt(m[4], 10), parseInt(m[3], 10));
        rest = m[5];
      }
    }

    // 3. "Do D.M., Title" (only end date known)
    if (!rest) {
      m = line.match(/^[Dd]o\s+(\d{1,2})\.(\d{1,2})\.?,\s+(.+)$/);
      if (m) {
        endsAt = this.buildDate(year, parseInt(m[2], 10), parseInt(m[1], 10));
        warnings.push("Only end date ('Do') provided; exact start date unknown.");
        rest = m[3];
      }
    }

    // 4. Same-month range: "3.-4.7., Title"
    if (!rest) {
      m = line.match(/^(\d{1,2})\.-(\d{1,2})\.(\d{1,2})\.?,\s+(.+)$/);
      if (m) {
        const mo = parseInt(m[3], 10);
        startsAt = this.buildDate(year, mo, parseInt(m[1], 10));
        endsAt = this.buildDate(year, mo, parseInt(m[2], 10));
        rest = m[4];
      }
    }

    // 5. Single date: "4.7., Title"
    if (!rest) {
      m = line.match(/^(\d{1,2})\.(\d{1,2})\.?,\s+(.+)$/);
      if (m) {
        startsAt = this.buildDate(year, parseInt(m[2], 10), parseInt(m[1], 10));
        rest = m[3];
      }
    }

    if (!rest) return null;

    const { title, city, description } = this.parseTitleAndLocation(rest);

    const categoryGuess = this.guessCategory(`${title} ${description}`);
    const category = categoryGuess || "ostalo";
    if (!categoryGuess) warnings.push("Kategorija nepoznata; pretpostavljeno ostalo.");

    const isFree = /besplatno|free|ulaz slobodan/i.test(rest)
      ? true
      : /eur|hrk|kn\b|cijena|ulaznica/i.test(rest)
      ? false
      : null;

    const missingFields: string[] = [];
    if (!title) missingFields.push("title");
    if (!startsAt && !endsAt) missingFields.push("startsAt");
    if (!city) missingFields.push("city");

    if (!city) warnings.push("Grad nije prepoznat – needs manual city");
    if (city && !this.KNOWN_CITIES.some((c) => c.toLowerCase() === city.toLowerCase())) {
      warnings.push(`Grad '${city}' nije u bazi – may need to be added to taxonomy`);
    }

    return {
      title,
      description,
      startsAt,
      endsAt,
      venueName: "",
      address: "",
      city,
      county: "",
      region: "",
      category,
      isFree,
      priceText: "",
      ticketUrl: "",
      sourceUrl,
      organizerName: "",
      imageUrl: "",
      confidence: this.calcConfidence(missingFields, warnings, isMonthOnly),
      missingFields,
      warnings,
      _status: "pending",
    };
  }

  private parseTitleAndLocation(text: string): { title: string; city: string; description: string } {
    // Split on en/em dash: – (U+2013) or — (U+2014)
    const dashIdx = text.search(/\s+[–—]\s+/);
    if (dashIdx >= 0) {
      const title = text.slice(0, dashIdx).trim();
      const afterDash = text.slice(dashIdx).replace(/^\s*[–—]\s*/, "").trim();
      const knownCity = this.findKnownCityNearEnd(afterDash);
      if (knownCity) return { title, city: knownCity, description: afterDash };
      return { title, city: "", description: afterDash };
    }
    return { title: text.trim(), city: this.findKnownCityNearEnd(text), description: "" };
  }

  private buildDate(year: number, month: number, day: number): string {
    try {
      return new Date(Date.UTC(year, month - 1, day, 10, 0, 0)).toISOString();
    } catch {
      return "";
    }
  }

  private calcConfidence(missingFields: string[], warnings: string[], monthOnly = false): number {
    let score = 0.9;
    score -= missingFields.length * 0.15;
    // Month-only date is a softer penalty than fully missing
    if (monthOnly) score -= 0.1;
    // Deduct for each significant warning (skip cosmetic ones)
    const significantWarnings = warnings.filter(
      (w) => !w.includes("nije u bazi") && !w.includes("Kategorija"),
    );
    score -= significantWarnings.length * 0.05;
    // Never reach 1.0 — always some review risk for parsed candidates
    return Math.max(0.1, Math.min(0.88, score));
  }

  // ── Block-based parser (fallback for other formats) ───────────────────────────

  private splitIntoEventBlocks(text: string): string[] {
    const datePattern = /\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\.?\b/g;
    const positions: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = datePattern.exec(text)) !== null) {
      positions.push(match.index);
    }
    if (positions.length < 2) return [text];
    const spread = positions[positions.length - 1] - positions[0];
    if (spread < 30) return [text];
    const blocks: string[] = [];
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i];
      const end = i + 1 < positions.length ? positions[i + 1] : text.length;
      const block = text.slice(start, end).trim();
      if (block.length > 20) blocks.push(block);
    }
    return blocks.length >= 2 ? blocks : [text];
  }

  private parseBlock(block: string, sourceUrl: string, organizerName?: string): Candidate {
    const date = this.matchDate(block);
    const time = this.matchTime(block);
    const startsAt = date ? this.buildDateTime(date, time || "18:00") : "";

    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    let title = "";
    let titleIdx = -1;

    const labeledTitle = this.matchLine(block, /(?:naslov|title)\s*:\s*(.+)/i);
    if (labeledTitle) {
      title = labeledTitle;
      titleIdx = lines.findIndex((l) => /(?:naslov|title)\s*:/i.test(l));
    } else {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!this.isDateLine(line) && !this.isLabelLine(line) && line.length >= 4 && line.length <= 150) {
          title = line;
          titleIdx = i;
          break;
        }
      }
    }

    const city =
      this.matchLine(block, /(?:grad|city|mjesto)\s*:\s*(.+)/i) ||
      this.findKnownCity(block);

    const categoryGuess = this.matchLine(block, /(?:kategorija|category)\s*:\s*(.+)/i) || this.guessCategory(block);
    const category = categoryGuess || "ostalo";

    const venueName = this.matchLine(block, /(?:lokacija|venue|dvorana|prostor)\s*:\s*(.+)/i) || "";

    const isFree = /besplatno|free|ulaz slobodan|ulaz je slobodan/i.test(block)
      ? true
      : /eur|hrk|kn\b|cijena|price|ulaznica|kuna/i.test(block)
      ? false
      : null;

    const ticketUrlMatch = block.match(/https?:\/\/(?:entrio|eventim|croticket|tickets)\S*/i);
    const ticketUrl = ticketUrlMatch?.[0] ?? "";

    const description =
      titleIdx >= 0
        ? lines.slice(titleIdx + 1).join(" ").trim().slice(0, 1000)
        : block.slice(0, 1000);

    const missingFields = [
      !title && "title",
      !startsAt && "startsAt",
      !city && "city",
    ].filter(Boolean) as string[];

    const warnings: string[] = [];
    if (!date) warnings.push("Datum nije pronađen – needs manual date");
    if (!city) warnings.push("Grad nije prepoznat – needs manual city");
    if (!time) warnings.push("Vrijeme nije pronađeno, pretpostavljeno 18:00");
    if (city && !this.KNOWN_CITIES.some((c) => c.toLowerCase() === city.toLowerCase())) {
      warnings.push(`Grad '${city}' nije u bazi – may need to be added to taxonomy`);
    }

    return {
      title,
      description,
      startsAt,
      endsAt: "",
      venueName,
      address: this.matchLine(block, /(?:adresa|address)\s*:\s*(.+)/i) || "",
      city: city || "",
      county: "",
      region: "",
      category,
      isFree,
      priceText: this.matchLine(block, /(?:cijena|price|ulaznica)\s*:\s*(.+)/i) || "",
      ticketUrl,
      sourceUrl,
      organizerName: organizerName || this.matchLine(block, /(?:organizator|organizer)\s*:\s*(.+)/i) || "",
      imageUrl: this.matchLine(block, /(?:slika|image|imageUrl)\s*:\s*(https?:\/\/\S+)/i) || "",
      // Cap at 0.88 — parsed candidates always need review
      confidence: Math.max(0.1, Math.min(0.88, 1.0 - missingFields.length * 0.15 - warnings.length * 0.04)),
      missingFields,
      warnings,
      _status: "pending",
    };
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────

  private matchTime(text: string): string {
    const explicit = this.matchLine(text, /(?:vrijeme|time)\s*[:\-]\s*(\d{1,2}[:.]\d{2})/i);
    if (explicit) return explicit.replace(".", ":");
    const withUnit = text.match(/\b(\d{1,2}[:.]\d{2})\s*(?:h|sati)\b/i)?.[1];
    if (withUnit) return withUnit.replace(".", ":");
    const plain = text.match(/\b([01]?\d|2[0-3])[.:]([0-5]\d)\b/)?.[0];
    if (plain) return plain.replace(".", ":");
    return "";
  }

  private buildDateTime(date: string, time: string): string {
    try {
      let t = time.replace(".", ":").trim();
      if (/^\d{1,2}:\d{2}$/.test(t)) {
        const [h, min] = t.split(":");
        t = `${h.padStart(2, "0")}:${min}`;
      } else {
        t = "18:00";
      }
      return new Date(`${date}T${t}:00`).toISOString();
    } catch {
      return "";
    }
  }

  private isDateLine(line: string): boolean {
    return (
      /^\d{1,2}\.\d{1,2}\.(20\d{2})/.test(line.trim()) ||
      /^(siječanj|veljača|ožujak|travanj|svibanj|lipanj|srpanj|kolovoz|rujan|listopad|studeni|prosinac)/i.test(line.trim())
    );
  }

  private isLabelLine(line: string): boolean {
    return /^(?:datum|date|vrijeme|time|grad|city|mjesto|kategorija|category|lokacija|venue|adresa|address|cijena|price|organizator|organizer|besplatno|free)\s*:/i.test(
      line.trim(),
    );
  }

  private matchLine(text: string, regex: RegExp): string {
    return text.match(regex)?.[1]?.trim() ?? "";
  }

  private matchDate(text: string): string {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const local = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\.?\b/);
    return local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "";
  }

  private findKnownCity(text: string): string {
    return this.KNOWN_CITIES.find((city) => this.containsCity(text, city)) ?? "";
  }

  private findKnownCityNearEnd(text: string): string {
    const parts = text.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts.slice().reverse()) {
      const city = this.findKnownCity(part);
      if (city) return city;
    }
    return this.findKnownCity(text);
  }

  private containsCity(text: string, city: string): boolean {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
  }

  private guessCategory(text: string): string {
    const lower = text.toLowerCase();
    for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
      if (category === "Ostalo") continue;
      if (keywords.some((k) => lower.includes(k))) return category;
    }
    return "";
  }

  private emptyCandidate(sourceUrl: string): ParsedEventCandidate {
    return {
      title: "", description: "", startsAt: "", endsAt: "",
      venueName: "", address: "", city: "", county: "", region: "",
      category: "ostalo", isFree: null, priceText: "", ticketUrl: "",
      sourceUrl, organizerName: "", imageUrl: "",
      confidence: 0.1,
      missingFields: ["title", "startsAt", "city"],
      warnings: ["Empty input"],
    };
  }
}
