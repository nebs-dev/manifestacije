import { Injectable } from "@nestjs/common";

export type ParsedEvent = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  address: string;
  city: string;
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

@Injectable()
export class AiEventParserService {
  async parse(input: { rawText?: string; sourceUrl?: string; organizerName?: string }): Promise<ParsedEvent> {
    const text = input.rawText || "";
    const title = this.matchLine(text, /(?:naslov|title)\s*:\s*(.+)/i) || text.split(/\n/).find(Boolean)?.slice(0, 120) || "";
    const city = this.matchLine(text, /(?:grad|city|mjesto)\s*:\s*(.+)/i) || this.findKnownCity(text);
    const category = this.matchLine(text, /(?:kategorija|category)\s*:\s*(.+)/i);
    const date = this.matchLine(text, /(?:datum|date)\s*:\s*(.+)/i) || this.matchDate(text);
    const time = this.matchLine(text, /(?:vrijeme|time)\s*:\s*(.+)/i) || "18:00";
    const startsAt = date ? new Date(`${date}T${time.length === 5 ? time : "18:00"}:00`).toISOString() : "";
    const venueName = this.matchLine(text, /(?:lokacija|venue)\s*:\s*(.+)/i);
    const ticketUrl = text.match(/https?:\/\/\S+/)?.[0] || input.sourceUrl || "";
    const isFree = /besplatno|free|ulaz slobodan/i.test(text) ? true : /eur|kn|cijena|price/i.test(text) ? false : null;
    const missingFields = [
      !title && "title",
      !startsAt && "startsAt",
      !city && "city",
      !category && "category",
      !venueName && "venueName"
    ].filter(Boolean) as string[];
    return {
      title,
      description: text,
      startsAt,
      endsAt: "",
      venueName,
      address: this.matchLine(text, /(?:adresa|address)\s*:\s*(.+)/i),
      city,
      category,
      isFree,
      priceText: this.matchLine(text, /(?:cijena|price)\s*:\s*(.+)/i),
      ticketUrl,
      sourceUrl: input.sourceUrl || "",
      organizerName: input.organizerName || this.matchLine(text, /(?:organizator|organizer)\s*:\s*(.+)/i),
      confidence: missingFields.length ? 0.45 : 0.78,
      missingFields,
      warnings: process.env.OPENAI_API_KEY ? ["OpenAI adapter placeholder; deterministic parser used in MVP"] : ["OPENAI_API_KEY missing; deterministic parser used"]
    };
  }

  private matchLine(text: string, regex: RegExp) {
    return text.match(regex)?.[1]?.trim() || "";
  }

  private matchDate(text: string) {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const local = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\.?\b/);
    return local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : "";
  }

  private findKnownCity(text: string) {
    return ["Osijek", "Zagreb", "Đakovo", "Vukovar", "Vinkovci", "Našice", "Valpovo", "Beli Manastir"].find((city) =>
      text.toLowerCase().includes(city.toLowerCase())
    ) || "";
  }
}
