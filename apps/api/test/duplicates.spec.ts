import { DuplicatesService } from "../src/duplicates/duplicates.service";
import { DuplicateInput, DuplicateRecord, duplicateSlots, matchDuplicate, normalizeDuplicateText } from "../src/duplicates/duplicate-matching";
import { retainCandidateDecisions } from "../src/ai-parser/candidate-filters";

const event = (over: Partial<DuplicateRecord> = {}): DuplicateRecord => ({
  id: 7, title: "Đurđevačka čarobna večer", slug: "vecer", status: "PUBLISHED", publishedAt: new Date(),
  startsAt: "2026-07-10T20:00:00+02:00", endsAt: "2026-07-10T23:00:00+02:00", cityId: 1, cityName: "Đurđevac",
  venue: { name: "Dvorana Šuma" }, organizerId: 2, ...over,
});
const input = (over: Partial<DuplicateInput> = {}): DuplicateInput => ({ title: "Durdevacka carobna vecer", startsAt: "2026-07-10T18:00:00Z", cityName: "Durdevac", venueName: "Dvorana Suma", ...over });
describe("shared deterministic duplicate matching", () => {
  it("handles Unicode/diacritics and near-identical distinctive titles", () => {
    expect(normalizeDuplicateText("ČĆ ĐŠŽ – café 東京")).toBe("cc dsz cafe 東京");
    expect(new DuplicatesService({} as never).titleSimilarity("Večer Đakovo", "Vecer Dakovo")).toBe(1);
    expect(matchDuplicate(input(), event())?.reasons).toContain("Podudaranje mjesta");
    expect(matchDuplicate(input({ title: "Koncert Đurđevačka čarobna večer" }), event())).not.toBeNull();
  });
  it.each([
    ["another date", { startsAt: "2026-07-11T18:00:00Z" }],
    ["next weekly occurrence", { startsAt: "2026-07-17T18:00:00Z" }],
    ["separate performance", { startsAt: "2026-07-10T20:00:00Z" }],
    ["different city", { cityName: "Osijek" }],
    ["different venue", { venueName: "Drugo kazalište" }],
    ["missing date", { startsAt: undefined }],
    ["ambiguous timezone", { startsAt: "2026-07-10T20:00:00" }],
    ["unrelated title", { title: "Tommy Emmanuel" }],
  ] as [string, Partial<DuplicateInput>][])("does not flag %s", (_name, over) => {
    expect(matchDuplicate(input(over), event())).toBeNull();
  });
  it("does not let a source URL override venue/date conflicts or generic city/day matches", () => {
    expect(matchDuplicate(input({ venueName: "Mala dvorana", address: "Trg 1" }), event({ venue: { name: "Velika dvorana", address: "Trg 1" } }))).toBeNull();
    expect(matchDuplicate(input({ sourceUrl: "https://example.test", venueName: "Drugo kazalište" }), event({ sourceUrl: "https://example.test" }))).toBeNull();
    expect(matchDuplicate(input({ sourceUrl: "https://example.test", startsAt: "2026-07-11T18:00:00Z" }), event({ sourceUrl: "https://example.test" }))).toBeNull();
    expect(matchDuplicate(input({ title: "Jazz večer", venueName: undefined }), event({ title: "Jazz večer", venue: null }))).toBeNull();
    expect(matchDuplicate(input({ title: "Jazz večer" }), event({ title: "Jazz večer" }))).not.toBeNull();
  });
  it.each(["DRAFT", "PENDING_REVIEW", "ARCHIVED"])("considers relevant %s records", status => {
    expect(matchDuplicate(input(), event({ status }))).not.toBeNull();
  });
  it.each([{ status: "REJECTED" }, { status: "ARCHIVED", publishedAt: null }])("excludes inactive %j", over => {
    expect(matchDuplicate(input(), event(over))).toBeNull();
  });
  it.each([
    ["2026-01-10T20:00:00+01:00", "2026-01-10T19:00:00Z"], ["2026-07-10T20:00:00+02:00", "2026-07-10T18:00:00Z"],
    ["2026-03-29T03:00:00+02:00", "2026-03-29T01:00:00Z"], ["2026-10-25T02:00:00+01:00", "2026-10-25T01:00:00Z"],
    ["2027-01-01T00:10:00+01:00", "2026-12-31T23:10:00Z"],
  ])("compares instants across CET/CEST/DST/year boundaries %s", (startsAt, utc) => {
    expect(matchDuplicate(input({ startsAt: utc }), event({ startsAt, endsAt: null }))).not.toBeNull();
  });
  it("does not equate two performances inside the repeated DST hour", () => {
    expect(matchDuplicate(input({ startsAt: "2026-10-25T02:00:00+01:00" }), event({ startsAt: "2026-10-25T02:00:00+02:00", endsAt: null }))).toBeNull();
  });
  it("matches overnight and genuine multi-day/all-day schedules", () => {
    const overnight = event({ startsAt: "2026-07-10T23:50:00+02:00", endsAt: "2026-07-11T02:00:00+02:00" });
    expect(matchDuplicate(input({ startsAt: "2026-07-11T00:05:00+02:00" }), overnight)).not.toBeNull();
    expect(matchDuplicate(input({ startsAt: "2026-07-11T10:00:00+02:00" }), overnight)).toBeNull();
    expect(matchDuplicate(input({ startsAt: "2026-07-12T18:00:00Z" }), event({ endsAt: "2026-07-13T18:00:00Z" }))).not.toBeNull();
    expect(matchDuplicate(input({ isAllDay: true, startsAt: "2026-07-10T00:00:00+02:00" }), event())).not.toBeNull();
  });
  it("compares actual occurrence slots, never an envelope, and checks later weekly creations", () => {
    const series = event({ endsAt: "2026-07-17T23:00:00+02:00", occurrences: [{ startsAt: "2026-07-10T18:00:00Z" }, { startsAt: "2026-07-17T18:00:00Z" }] });
    expect(matchDuplicate(input({ startsAt: "2026-07-12T18:00:00Z" }), series)).toBeNull();
    expect(matchDuplicate(input({ startsAt: "2026-07-17T18:00:00Z" }), series)?.startsAt.toISOString()).toBe("2026-07-17T18:00:00.000Z");
    expect(matchDuplicate(input({ repeatWeeklyUntil: "2026-07-24T18:00:00Z" }), event({ startsAt: "2026-07-17T18:00:00Z", endsAt: null }))).not.toBeNull();
    expect(duplicateSlots(input({ repeatWeeklyUntil: "2099-07-24" }))).toHaveLength(52);
  });
});

describe("disclosure and no mutations", () => {
  it("discloses public/owned records and only a generic boolean for foreign private matches", async () => {
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([event(), event({ id: 8, status: "DRAFT", organizerId: 99 }), event({ id: 9, status: "PENDING_REVIEW", organizerId: 1 })]) } };
    const service = new DuplicatesService(prisma as never), own = await service.check(input(), 1);
    expect(own.matches.map(row => row.id)).toEqual([7, 9]); expect(own.hiddenMatch).toBe(true);
    expect(own.matches[0].href).toBe("/eventi/vecer"); expect(own.matches[1].href).toBe("/organizer/events/9");
    expect(JSON.stringify(own)).not.toContain('"id":8');
    expect((await service.check(input())).matches.map(row => row.id)).toEqual([7, 8, 9]);
    expect(Object.keys(prisma.event)).toEqual(["findMany"]);
  });
  it("has no private record details/counts and makes no query for an incomplete schedule", async () => {
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([event({ status: "DRAFT", organizerId: 99 })]) } };
    const service = new DuplicatesService(prisma as never);
    expect(await service.check(input(), 1)).toEqual({ matches: [], hiddenMatch: true });
    prisma.event.findMany.mockClear();
    expect(await service.check({ title: "Koncert" })).toEqual({ matches: [], hiddenMatch: false });
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });
  it("retains existing duplicate-review decisions when rescoring a pair", async () => {
    const upsert = jest.fn().mockResolvedValue({ status: "DISMISSED" });
    await new DuplicatesService({ event: { findUnique: async () => event(), findMany: async () => [event({ id: 8 })] }, eventDuplicateCandidate: { upsert } } as never).detectForEvent(7);
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty("status");
    expect(upsert.mock.calls[0][0].create.reason).toContain("Podudaranje naslova");
  });
  it("retains source metadata and reviewed content/status/indexes during reparse", () => {
    const created = { title: "Đurđevačka večer", startsAt: "2026-07-10T18:00:00Z", _status: "created", _eventId: 7, custom: "reviewed" };
    const ignored = { title: "Druga večer", startsAt: "2026-07-17T18:00:00Z", _status: "ignored" };
    const previous = { sourceImageUrl: "https://image.test", custom: "kept", candidates: [created, ignored] };
    const retained = retainCandidateDecisions(previous, { sourceUrl: "https://source.test", sourceType: "batch", candidates: [{ ...created, _status: "pending" }, { title: "Novi", startsAt: "2026-07-24T18:00:00Z" }] } as never);
    expect(retained).toMatchObject({ sourceImageUrl: previous.sourceImageUrl, custom: "kept" });
    expect(retained.candidates.slice(0, 2)).toEqual([created, ignored]); expect(retained.candidates).toHaveLength(3);
  });
  it("keeps distinct same-title/time candidates at different venues separate during reparse", () => {
    const candidate = { title: "Čarobna večer", startsAt: "2026-07-10T18:00:00Z", city: "Đurđevac", venueName: "Mala dvorana", _status: "created", _eventId: 7 };
    const retained = retainCandidateDecisions({ candidates: [candidate] }, { candidates: [{ ...candidate, venueName: "Velika dvorana", _status: "pending" }] } as never);
    expect(retained.candidates).toHaveLength(2);
    expect(retained.candidates[0]).toEqual(candidate);
  });
});
