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
  it.each([
    ["13.–29. studenoga 2026.", ["2026-11-13", "2026-11-29"]],
    ["13. - 15. 11. 2026.", ["2026-11-13", "2026-11-15"]],
    ["3.-4.7.2026.", ["2026-07-03", "2026-07-04"]],
    ["12.10.-13.10.2027.", ["2027-10-12", "2027-10-13"]],
  ])("reads both ends of the range %s", (text, expected) => {
    expect(sourceDates(text as string)).toEqual(expected);
  });
  it.each([
    ["13. stu. 2026.", "2026-11-13"],
    ["5. svi. 2026.", "2026-05-05"],
    ["13/11/2026", "2026-11-13"],
    ["13-11-2026", "2026-11-13"],
  ])("reads the shorthand date %s", (text, expected) => {
    expect(sourceDates(text as string)).toEqual([expected]);
  });
  it.each(["svi su dobrodošli 5. 2026.", "13. studenoga 2026."])("does not invent a month from ordinary words in %s", (text) => {
    expect(sourceDates(text)).not.toContain("2026-05-05");
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
  // Month confusion (the reported rujan/listopad swap) is the model's
  // arithmetic going wrong next to a quote that is right. Dropping the term
  // left the editor with nothing; the quote carries the date instead.
  it.each([
    ["2027-11-12", "12. listopada 2027.", "2027-10-12"],
    ["2027-10-12", "12. rujna 2027.", "2027-09-12"],
  ])("corrects month confusion %s against the quote %s", async (date, dateText, expected) => {
    const result = await run({ startsAt: `${date}T20:00:00`, dateText, timeText: "20:00", confidence: 0.99 });
    expect(result.startsAt).toBe(`${expected}T20:00:00+02:00`);
    expect(result.confidence).toBeLessThanOrEqual(0.6);
    expect(result.warnings.join(" ")).toMatch(/parser je predložio 2027-1[01]-12T20:00:00/i);
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
  // Reported case (10. 11. 2026.): the sign-up screenshot listing four
  // Saturday terms came back with every startsAt empty — the model read the
  // date into dateText but refused to commit a value, so the editor got the
  // red "no date" marker. The quoted evidence carries the value.
  it("fills the term from the quoted evidence when the model leaves startsAt empty", async () => {
    const result = await run({
      title: "Prijava: Hot yoga",
      startsAt: "",
      dateText: "Subota, 14. studenoga 2026.",
      timeText: "17:30 – 19:00",
      missingFields: ["startsAt"],
    });
    expect(result.startsAt).toBe("2026-11-14T17:30:00+01:00");
    expect(result.endsAt).toBe("2026-11-14T19:00:00+01:00");
    expect(result.missingFields).not.toContain("startsAt");
    expect(result.warnings.join(" ")).toMatch(/izveden/i);
  });

  it("assumes the current year for an evidence-derived term with no year on the poster", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-10T09:00:00Z"));
    const result = await run({ startsAt: "", dateText: "Subota, 14. studenog", timeText: "17:30 – 19:00" });
    expect(result.startsAt).toBe("2026-11-14T17:30:00+01:00");
    expect(result.warnings.join(" ")).toMatch(/godin/i);
  });

  it.each([
    ["an ambiguous date", { dateText: "13. studenoga 2026. ili 14. studenoga 2026.", timeText: "17:30" }],
    ["no stated time", { dateText: "Subota, 14. studenoga 2026.", timeText: "" }],
  ])("still refuses to invent a term from %s", async (_label, evidence) => {
    const result = await run({ startsAt: "", ...evidence });
    expect(result.startsAt).toBe("");
    expect(result.missingFields).toContain("startsAt");
  });

  it.each([
    ["2026-12-20", "5. siječnja", "2027-01-05"],
    ["2026-12-20", "5. prosinca", "2026-12-05"],
    ["2026-11-10", "5. prosinca", "2026-12-05"],
    ["2026-11-10", "5. listopada", "2026-10-05"],
  ])("on %s reads the yearless %s as %s", (today, text, expected) => {
    expect(sourceDates(text, new Date(`${today}T09:00:00Z`))).toEqual([expected]);
  });

  // The year belongs to the source. A model that picks a different one for
  // a poster that prints none used to lose the term outright — that is how
  // the fourth sign-up term (5. prosinca) disappeared on one run.
  it.each(["2025-12-05T17:30:00", "2027-12-05T17:30:00"])("takes the year from the source when the model proposes %s", async (startsAt) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-10T09:00:00Z"));
    const result = await run({ startsAt, dateText: "Subota, 5. prosinca", timeText: "17:30 – 19:00" });
    expect(result.startsAt).toBe("2026-12-05T17:30:00+01:00");
    expect(result.warnings.join(" ")).toMatch(/godin/i);
  });

  // Exactly the production case: the model turned "Subota, 5. prosinca"
  // into 2027-01-05, wrong in both month and year.
  it("takes the quoted date when the model is wrong in month and year at once", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-10T09:00:00Z"));
    const result = await run({ startsAt: "2027-01-05T17:30:00", dateText: "Subota, 5. prosinca", timeText: "17:30 – 19:00" });
    expect(result.startsAt).toBe("2026-12-05T17:30:00+01:00");
    expect(result.endsAt).toBe("2026-12-05T19:00:00+01:00");
  });

  it.each([
    ["two candidate dates", { dateText: "5. prosinca 2026. ili 12. prosinca 2026.", timeText: "17:30" }],
    ["two candidate times", { dateText: "5. prosinca 2026.", timeText: "20:00 ili 21:00" }],
    ["no time at all", { dateText: "5. prosinca 2026.", timeText: "" }],
  ])("still refuses to choose when the quote is ambiguous: %s", async (_label, evidence) => {
    // The proposed value is one the quote never states, so there is nothing
    // to confirm it and nothing unambiguous to put in its place.
    const result = await run({ startsAt: "2026-12-20T18:00:00", ...evidence });
    expect(result.startsAt).toBe("");
    expect(result.missingFields).toContain("startsAt");
  });

  // Reported case (10. 11. 2026., second pass): three of the four terms on
  // the sign-up screenshot checked out and the fourth did not, which blanked
  // the whole event. The confirmed terms stay, with the warning.
  it("keeps the confirmed terms when one term in a schedule fails", async () => {
    const term = (day: number, date: string) => ({
      startsAt: date, dateText: `Subota, ${day}. studenoga 2026.`, timeText: "17:30",
    });
    const result = await run({
      occurrences: [
        term(14, "2026-11-14T17:30:00"),
        term(21, "2026-11-21T17:30:00"),
        { startsAt: "2026-11-28T17:30:00", dateText: "Subota, 28. studenoga 2026.", timeText: "" },
      ],
    });
    expect(result.occurrences?.map((item) => item.startsAt)).toEqual([
      "2026-11-14T17:30:00+01:00", "2026-11-21T17:30:00+01:00",
    ]);
    expect(result.startsAt).toBe("2026-11-14T17:30:00+01:00");
    expect(result.warnings.join(" ")).toMatch(/Neki termini nisu potvr/);
  });

  // Reported case: a sign-up poster listing four Saturday terms as
  // "17:30 – 19:00" imported with no dates at all, because each term stated
  // two times.
  it("imports a schedule whose terms state a time range", async () => {
    const term = (day: number) => ({
      startsAt: `2026-11-${day}T17:30:00`,
      endsAt: `2026-11-${day}T19:00:00`,
      dateText: `Subota, ${day}. studenoga 2026.`,
      timeText: "17:30 – 19:00",
      endTimeText: "17:30 – 19:00",
    });
    const result = await run({ occurrences: [term(14), term(21), term(28)] });
    expect(result.occurrences?.map((item) => item.startsAt)).toEqual([
      "2026-11-14T17:30:00+01:00", "2026-11-21T17:30:00+01:00", "2026-11-28T17:30:00+01:00",
    ]);
    expect(result.occurrences?.[0].endsAt).toBe("2026-11-14T19:00:00+01:00");
    expect(result.startsAt).toBe("2026-11-14T17:30:00+01:00");
    expect(result.warnings.join(" ")).toContain("više termina");
  });

  // Until 10. 11. 2026. one unconfirmed term blanked the whole event. It
  // cost the reported four-term sign-up poster every one of its dates, so
  // the confirmed terms are now kept and the warning carries the rest.
  it("keeps the confirmed terms and warns instead of dropping a whole schedule", async () => {
    const result = await run({ occurrences: [
      { startsAt: "2027-10-12T20:00:00", dateText: "12. listopada 2027.", timeText: "20:00" },
      { startsAt: "2027-10-13T18:00:00", dateText: "13. listopada 2027.", timeText: "" },
    ] });
    expect(result.startsAt).toBe("2027-10-12T20:00:00+02:00");
    expect(result.occurrences?.map((item) => item.startsAt)).toEqual(["2027-10-12T20:00:00+02:00"]);
    expect(result.missingFields).not.toContain("startsAt");
    expect(result.warnings.join(" ")).toMatch(/Neki termini nisu potvr/);
  });
});
