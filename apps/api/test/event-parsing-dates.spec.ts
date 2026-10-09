import Anthropic from "@anthropic-ai/sdk";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";
import { sourceDates, sourceTimes } from "../src/ai-parser/date-evidence";
import { parseZagrebWallTime, zagrebDateKey } from "../src/common/zagreb-time";
import { dropPastCandidates } from "../src/ai-parser/candidate-filters";

jest.mock("@anthropic-ai/sdk", () => ({ __esModule: true, default: jest.fn() }));

describe("Zagreb parser regressions", () => {
  const parser = new AiEventParserService();
  const originalZone = process.env.TZ;
  afterEach(() => { process.env.TZ = originalZone; jest.useRealTimers(); });

  it.each(["UTC", "America/Los_Angeles", "Asia/Tokyo", "Europe/Zagreb"])("is independent of server timezone %s", async (zone) => {
    process.env.TZ = zone;
    for (const [date, expected] of [["2027-01-12", "2027-01-12T20:00:00+01:00"], ["2027-07-12", "2027-07-12T20:00:00+02:00"]]) {
      const candidate = await parser.parse({ rawText: `Naslov: Koncert\nDatum: ${date}\nVrijeme: 20.00\nGrad: Osijek` });
      expect(candidate.startsAt).toBe(expected);
    }
  });

  it.each([
    ["2026-03-29", "01:30", "2026-03-29T01:30:00+01:00"],
    ["2026-03-29", "02:30", ""],
    ["2026-03-29", "03:30", "2026-03-29T03:30:00+02:00"],
    ["2026-10-25", "01:30", "2026-10-25T01:30:00+02:00"],
    ["2026-10-25", "02:30", ""],
    ["2026-10-25", "03:30", "2026-10-25T03:30:00+01:00"],
    ["2027-02-29", "20:00", ""],
    ["2028-02-29", "20:00", "2028-02-29T20:00:00+01:00"],
  ])("resolves %s %s without guessing through DST or invalid dates", (date, time, expected) => {
    expect(parseZagrebWallTime(date, time)).toBe(expected);
  });

  it.each(["12. rujna 2027.", "12 rujan 2027", "12. RUJNA 2027"])("maps September from %s", (text) => {
    expect(sourceDates(text)).toEqual(["2027-09-12"]);
  });
  it.each(["12. listopada 2027.", "12 listopad 2027", "12. LISTOPADA 2027"])("maps October from %s", (text) => {
    expect(sourceDates(text)).toEqual(["2027-10-12"]);
  });
  it.each(["20:00", "20.00", "20 h", "20h", "20.00h", "20:00h", "20 sati", "u 20.00 sati"])("recognizes %s", (text) => {
    expect(sourceTimes(`12.10.2027. ${text}`)).toEqual(["20:00"]);
  });
  it.each(["12.10.", "12.10.2027.", "2027-10-12", "12.10", "31.12.2027.", "20:99", "24:00"])("never uses date/invalid token %s as a time", (text) => {
    expect(sourceTimes(text)).toEqual([]);
  });

  it("uses Zagreb's current year at the UTC year boundary and flags the assumption", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-12-31T23:15:00Z"));
    expect(zagrebDateKey()).toBe("2027-01-01");
    const candidate = await parser.parse({ rawText: "Naslov: Koncert\n1. siječnja u 20 h\nOsijek" });
    expect(candidate.startsAt).toBe("2027-01-01T20:00:00+01:00");
    expect(candidate.warnings.join(" ")).toMatch(/Godina/);
  });

  it.each(["12.10.2027.", "12.10.2027. u 12.10", "12.10.2027. u 20:00 ili 21:00", "29.3.2026. u 02:30"])("surfaces absent, ambiguous or nonexistent time: %s", async (text) => {
    const candidate = await parser.parse({ rawText: `Naslov: Koncert\n${text}\nOsijek` });
    if (text.includes("u 12.10")) expect(candidate.startsAt).toBe("2027-10-12T12:10:00+02:00");
    else {
      expect(candidate.startsAt).toBe("");
      expect(candidate.missingFields).toContain("startsAt");
      expect(candidate.warnings.length).toBeGreaterThan(0);
    }
  });

  it("only sets all-day when stated", async () => {
    const candidate = await parser.parse({ rawText: "Naslov: Sajam\n12.10.2027. cijeli dan\nOsijek" });
    expect(candidate.startsAt).toBe("2027-10-12T00:00:00+02:00");
    expect(candidate.isAllDay).toBe(true);
  });

  it("keeps a date-only listing through its final Zagreb day for review", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-04T12:00:00+02:00"));
    const listing = await parser.parseBatch({ rawText: "SRPANJ 2026.\n3.-4.7., Sajam – Osijek" });
    expect(dropPastCandidates(listing).candidates).toHaveLength(1);
    jest.setSystemTime(new Date("2026-07-05T00:00:00+02:00"));
    expect(dropPastCandidates(listing).candidates).toHaveLength(0);
  });

  it("converts naive structured times and preserves valid explicit instants", () => {
    for (const raw of ["2027-01-12 20:00:00", "2027-01-12T20:00:00+01:00"]) {
      const result = parser.extractJsonLdEvents(`<script type="application/ld+json">${JSON.stringify({ "@type": "Event", name: "Koncert", startDate: raw })}</script>`, "https://example.hr");
      expect(result?.candidates[0].startsAt).toBe("2027-01-12T20:00:00+01:00");
    }
  });
});

describe("LLM screenshot/text date validation", () => {
  const parser = new AiEventParserService();
  const originalKey = process.env.ANTHROPIC_API_KEY;
  let create: jest.Mock;
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-only";
    create = jest.fn();
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({ messages: { create } }));
  });
  afterEach(() => { process.env.ANTHROPIC_API_KEY = originalKey; });
  const run = async (candidate: Record<string, unknown>, screenshot = true) => {
    create.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(candidate) }] });
    return (await parser.parseBatchWithLlm({ ...(screenshot ? { screenshotBase64: "test" } : { rawText: "12. listopada 2027. u 20.00" }) })).candidates[0];
  };

  it.each([["2027-01-12", "12. siječnja 2027.", "+01:00"], ["2027-07-12", "12. srpnja 2027.", "+02:00"]])("derives offset for %s instead of trusting LLM +02:00", async (date, dateText, offset) => {
    const result = await run({ startsAt: `${date}T20:00:00+02:00`, dateText, timeText: "20.00" });
    expect(result.startsAt).toBe(`${date}T20:00:00${offset}`);
  });
  it.each([["2027-11-12", "12. listopada 2027."], ["2027-10-12", "12. rujna 2027."]])("rejects month confusion %s / %s", async (date, dateText) => {
    const result = await run({ startsAt: `${date}T20:00:00`, dateText, timeText: "20:00", confidence: 0.99 });
    expect(result.startsAt).toBe("");
    expect(result.missingFields).toContain("startsAt");
    expect(result.confidence).toBeLessThanOrEqual(0.6);
    expect(result.warnings.join(" ")).toMatch(/pregled/);
  });
  it.each(["", "12.10.", "20:00 ili 21:00"])("rejects invented 18:00 when source time is %s", async (timeText) => {
    const result = await run({ startsAt: "2027-10-12T18:00:00", dateText: "12. listopada 2027.", timeText });
    expect(result.startsAt).toBe("");
  });
  it("rejects invented textual evidence absent from a text source", async () => {
    const result = await run({ startsAt: "2027-10-12T21:00:00", dateText: "12. listopada 2027.", timeText: "21:00" }, false);
    expect(result.startsAt).toBe("");
  });
  it("preserves an explicitly supplied overnight end, deriving the next date", async () => {
    const result = await run({ startsAt: "2027-10-12T22:00:00", dateText: "12. listopada 2027.", timeText: "22:00", endsAt: "2027-10-13T02:00:00", endTimeText: "02:00" });
    expect(result.startsAt).toBe("2027-10-12T22:00:00+02:00");
    expect(result.endsAt).toBe("2027-10-13T02:00:00+02:00");
  });
  it("does not silently drop an invalid occurrence and import the remaining schedule", async () => {
    const result = await run({ occurrences: [
      { startsAt: "2027-10-12T20:00:00", dateText: "12. listopada 2027.", timeText: "20:00" },
      { startsAt: "2027-10-13T18:00:00", dateText: "13. listopada 2027.", timeText: "" },
    ] });
    expect(result.startsAt).toBe("");
    expect(result.occurrences).toBeUndefined();
    expect(result.missingFields).toContain("startsAt");
  });
});
