import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";

describe("AiEventParserService", () => {
  it("parses deterministic structured text", async () => {
    const parser = new AiEventParserService();
    const parsed = await parser.parse({
      rawText: "Naslov: Koncert\nDatum: 2026-07-10\nVrijeme: 20:00\nGrad: Osijek\nKategorija: Glazba\nLokacija: Tvrđa\nBesplatno"
    });
    expect(parsed.title).toBe("Koncert");
    expect(parsed.city).toBe("Osijek");
    expect(parsed.isFree).toBe(true);
    expect(parsed.missingFields).toEqual([]);
  });
});
