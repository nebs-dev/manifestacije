"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_event_parser_service_1 = require("../src/ai-parser/ai-event-parser.service");
describe("AiEventParserService", () => {
    it("parses deterministic structured text", async () => {
        const parser = new ai_event_parser_service_1.AiEventParserService();
        const parsed = await parser.parse({
            rawText: "Naslov: Koncert\nDatum: 2026-07-10\nVrijeme: 20:00\nGrad: Osijek\nKategorija: Glazba\nLokacija: Tvrđa\nBesplatno"
        });
        expect(parsed.title).toBe("Koncert");
        expect(parsed.city).toBe("Osijek");
        expect(parsed.isFree).toBe(true);
        expect(parsed.missingFields).toEqual([]);
    });
});
