import { Injectable } from "@nestjs/common";

export type ParsedEventCandidate = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  address: string;
  city: string;
  county: string;
  region: string;
  category: string;
  isFree: boolean | null;
  priceText: string;
  ticketUrl: string;
  sourceUrl: string;
  organizerName: string;
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

@Injectable()
export class AiEventParserService {
  private readonly KNOWN_CITIES = [
    "Osijek", "Zagreb", "Đakovo", "Vukovar", "Vinkovci", "Našice", "Valpovo", "Beli Manastir",
    "Slavonski Brod", "Požega", "Virovitica", "Koprivnica", "Čakovec", "Kneževi Vinogradi",
    "Batina", "Darda", "Bilje", "Čepin", "Petrijevci", "Sarvaš", "Tenja", "Aljmaš",
    "Split", "Rijeka", "Zadar", "Šibenik", "Dubrovnik", "Pula", "Varaždin", "Karlovac",
    "Sisak", "Bjelovar", "Gospić", "Krapina", "Pazin", "Baranja",
  ];

  private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
    "Glazba": ["koncert", "glazba", "music", "festival", "zbor", "orkestar", "pjevanje", "nastup"],
    "Kultura": ["izložba", "kultura", "muzej", "galerija", "kazalište", "predstava", "film", "kulturni"],
    "Djeca i obitelj": ["djeca", "obitelj", "kids", "family", "dječji", "za djecu"],
    "Sport": ["sport", "trčanje", "maraton", "natjecanje", "turnir", "liga", "utrka"],
    "Outdoor": ["outdoor", "hiking", "planina", "bicikl", "šetnja", "rafting", "natural"],
    "Hrana i vino": ["hrana", "vino", "wine", "kulinarstvo", "gastronomija", "pivnica", "kuhanje", "pić"],
    "Radionice": ["radionica", "workshop", "tečaj", "seminar", "predavanje", "edukacij"],
    "Sajmovi": ["sajam", "market", "tržnica", "vašar", "izložba"],
    "Tradicija i folklor": ["folklor", "tradicija", "ethnic", "etno", "narodni", "folklorni", "vez", "vezovi"],
    "Humanitarno": ["humanitarn", "dobrotvorn", "donacij"],
    "Ostalo": [],
  };

  async parseBatch(input: { rawText?: string; rawHtml?: string; sourceUrl?: string; organizerName?: string }): Promise<ParsedSourceResult> {
    const text = input.rawHtml ? this.htmlToText(input.rawHtml) : (input.rawText || "");
    const sourceUrl = input.sourceUrl || "";

    const blocks = this.splitIntoEventBlocks(text);
    const isBatch = blocks.length > 1;

    const candidates = blocks.map((block) => this.parseBlock(block, sourceUrl, input.organizerName));

    return {
      sourceUrl,
      sourceType: isBatch ? "batch" : "single",
      candidates,
    };
  }

  // Backward-compatible single-event parse
  async parse(input: { rawText?: string; rawHtml?: string; sourceUrl?: string; organizerName?: string }): Promise<ParsedEvent> {
    const result = await this.parseBatch(input);
    return result.candidates[0] ?? this.emptyCandidate(input.sourceUrl || "");
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse only horizontal whitespace (preserve newlines)
      .replace(/[^\S\n]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private splitIntoEventBlocks(text: string): string[] {
    const datePattern = /\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\.?\b/g;
    const positions: number[] = [];
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      positions.push(match.index);
    }

    if (positions.length < 2) return [text];

    // Only split if there is real content between dates (not just within one sentence)
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

  private parseBlock(block: string, sourceUrl: string, organizerName?: string): ParsedEventCandidate & { _status: "pending" } {
    const date = this.matchDate(block);
    const time = this.matchTime(block);
    const startsAt = date ? this.buildDateTime(date, time || "18:00") : "";

    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    let title = "";
    let titleIdx = -1;

    // Check for explicit "Naslov: X" label first
    const labeledTitle = this.matchLine(block, /(?:naslov|title)\s*:\s*(.+)/i);
    if (labeledTitle) {
      title = labeledTitle;
      titleIdx = lines.findIndex((l) => /(?:naslov|title)\s*:/i.test(l));
    } else {
      // First non-date, non-label line
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

    const category =
      this.matchLine(block, /(?:kategorija|category)\s*:\s*(.+)/i) ||
      this.guessCategory(block);

    const venueName =
      this.matchLine(block, /(?:lokacija|venue|dvorana|prostor)\s*:\s*(.+)/i) || "";

    const isFree = /besplatno|free|ulaz slobodan|ulaz je slobodan/i.test(block)
      ? true
      : /eur|hrk|kn\b|cijena|price|ulaznica|kuna/i.test(block)
      ? false
      : null;

    const ticketUrlMatch = block.match(/https?:\/\/(?:entrio|eventim|croticket|tickets)\S*/i);
    const ticketUrl = ticketUrlMatch?.[0] || "";

    const description =
      titleIdx >= 0
        ? lines.slice(titleIdx + 1).join(" ").trim().slice(0, 1000)
        : block.slice(0, 1000);

    const missingFields = [
      !title && "title",
      !startsAt && "startsAt",
      !city && "city",
      !category && "category",
    ].filter(Boolean) as string[];

    const warnings: string[] = [];
    if (!date) warnings.push("Datum nije pronađen – needs manual date");
    if (!city) warnings.push("Grad nije prepoznat – needs manual city");
    if (!time) warnings.push("Vrijeme nije pronađeno, pretpostavljeno 18:00");
    if (city && !this.KNOWN_CITIES.some((c) => c.toLowerCase() === city.toLowerCase())) {
      warnings.push(`Grad '${city}' nije u bazi – may need to be added to taxonomy`);
    }

    const confidence = Math.max(0.1, Math.min(1.0, 1.0 - missingFields.length * 0.15 - warnings.length * 0.04));

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
      category: category || "",
      isFree,
      priceText: this.matchLine(block, /(?:cijena|price|ulaznica)\s*:\s*(.+)/i) || "",
      ticketUrl,
      sourceUrl,
      organizerName: organizerName || this.matchLine(block, /(?:organizator|organizer)\s*:\s*(.+)/i) || "",
      confidence,
      missingFields,
      warnings,
      _status: "pending",
    };
  }

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
        const [h, m] = t.split(":");
        t = `${h.padStart(2, "0")}:${m}`;
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
    return /^(?:datum|date|vrijeme|time|grad|city|mjesto|kategorija|category|lokacija|venue|adresa|address|cijena|price|organizator|organizer|besplatno|free)\s*:/i.test(line.trim());
  }

  private matchLine(text: string, regex: RegExp): string {
    return text.match(regex)?.[1]?.trim() || "";
  }

  private matchDate(text: string): string {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const local = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\.?\b/);
    return local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "";
  }

  private findKnownCity(text: string): string {
    return this.KNOWN_CITIES.find((city) => text.toLowerCase().includes(city.toLowerCase())) || "";
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
      category: "", isFree: null, priceText: "", ticketUrl: "",
      sourceUrl, organizerName: "",
      confidence: 0.1,
      missingFields: ["title", "startsAt", "city", "category"],
      warnings: ["Empty input"],
    };
  }
}
