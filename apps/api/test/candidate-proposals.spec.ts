import { proposeFromFresh } from "../src/ai-parser/candidate-filters";
import type { ParsedSourceResult } from "../src/ai-parser/ai-event-parser.service";

const candidate = (overrides: Record<string, unknown>) => ({
  title: "Koncert", description: "Opis", startsAt: "2099-11-20T20:00:00+01:00", endsAt: "", venueName: "Dvorana", address: "", city: "Osijek",
  county: "", region: "", category: "glazba", isFree: true, priceText: "", ticketUrl: "", sourceUrl: "", organizerName: "", imageUrl: "",
  confidence: 0.8, missingFields: [], warnings: [], _status: "pending", ...overrides,
}) as ParsedSourceResult["candidates"][number];
const result = (candidates: ParsedSourceResult["candidates"]): ParsedSourceResult => ({ sourceUrl: "", sourceType: "batch", candidates });

describe("proposeFromFresh (EVT-08)", () => {
  it("keeps open candidate values and proposes only changed fields", () => {
    const previous = result([candidate({ title: "Koncert", startsAt: "", priceText: "", missingFields: ["startsAt"] })]);
    const merged = proposeFromFresh(previous, result([candidate({ title: "Koncert", startsAt: "2099-11-20T20:00:00+01:00", priceText: "10 EUR", isFree: false })]));
    expect(merged.candidates).toHaveLength(1);
    expect(merged.candidates[0]).toMatchObject({ title: "Koncert", startsAt: "", priceText: "", _status: "pending",
      _proposal: { startsAt: "2099-11-20T20:00:00+01:00", priceText: "10 EUR", isFree: false } });
  });

  it("never touches created or ignored candidates and does not re-add them", () => {
    const previous = result([candidate({ title: "Stvoreni", _status: "created", _eventId: 7 }), candidate({ title: "Zanemareni", _status: "ignored" })]);
    const merged = proposeFromFresh(previous, result([candidate({ title: "Stvoreni", description: "Novi opis" }), candidate({ title: "Zanemareni", priceText: "5 EUR" })]));
    expect(merged.candidates).toEqual(previous.candidates);
  });

  it("pairs a single open candidate with a single new result even when the title changed", () => {
    const previous = result([candidate({ title: "Plakat bez naslova", startsAt: "" }), candidate({ title: "Gotovo", _status: "created" })]);
    const merged = proposeFromFresh(previous, result([candidate({ title: "Jesenski koncert", startsAt: "2099-11-21T19:00:00+01:00" }), candidate({ title: "Gotovo" })]));
    expect(merged.candidates).toHaveLength(2);
    expect(merged.candidates[0]).toMatchObject({ title: "Plakat bez naslova", _proposal: { title: "Jesenski koncert", startsAt: "2099-11-21T19:00:00+01:00" } });
  });

  it("pairs an undated open candidate with the unique same-title result instead of adding a duplicate", () => {
    const previous = result([candidate({ title: "Jesenski koncert", startsAt: "" }), candidate({ title: "Drugi", startsAt: "2099-12-01T18:00:00+01:00", _status: "created" })]);
    const merged = proposeFromFresh(previous, result([candidate({ title: "Jesenski koncert", startsAt: "2099-11-20T20:00:00+01:00" }), candidate({ title: "Treći", startsAt: "2099-12-05T18:00:00+01:00" })]));
    expect(merged.candidates).toHaveLength(3);
    expect(merged.candidates[0]).toMatchObject({ startsAt: "", _proposal: { startsAt: "2099-11-20T20:00:00+01:00" } });
    expect(merged.candidates[2]).toMatchObject({ title: "Treći", _fromSupplement: true });
  });

  it("appends genuinely new events as open candidates marked as coming from a supplement", () => {
    const previous = result([candidate({ title: "Prvi" }), candidate({ title: "Drugi", startsAt: "2099-12-01T18:00:00+01:00" })]);
    const merged = proposeFromFresh(previous, result([candidate({ title: "Prvi" }), candidate({ title: "Drugi", startsAt: "2099-12-01T18:00:00+01:00" }), candidate({ title: "Treći", startsAt: "2099-12-05T18:00:00+01:00" })]));
    expect(merged.candidates.map((c) => c.title)).toEqual(["Prvi", "Drugi", "Treći"]);
    expect(merged.candidates[2]).toMatchObject({ _status: "pending", _fromSupplement: true });
    expect(merged.candidates[0]).not.toHaveProperty("_proposal");
  });

  it("returns the fresh result when there was nothing before (failed first parse)", () => {
    const fresh = result([candidate({ title: "Novi" })]);
    expect(proposeFromFresh({ candidates: [] }, fresh)).toBe(fresh);
  });
});
