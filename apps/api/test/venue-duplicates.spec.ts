import { looksLikeSameVenue, venueDuplicateGroups, venueKey } from "../src/admin/venue-duplicates";

describe("venue duplicate detection", () => {
  it("strips the word that says what kind of place it is", () => {
    expect(venueKey("Klub Oxygene")).toBe("oxygene");
    expect(venueKey("Caffe bar Oxygene")).toBe("oxygene");
    // A name made only of generic words keeps them, or nothing would be left.
    expect(venueKey("Dvorana")).toBe("dvorana");
  });

  it.each([
    ["Oxygene", "Klub Oxygene"],
    ["Dom kulture", "Dom kulture Osijek"],
    ["Galerija Waldinger", "Waldinger"],
    ["Kino Urania", "Urania"],
    ["Oxygene", "Oxygen"],
  ])("pairs %s with %s", (a, b) => {
    expect(looksLikeSameVenue(a, b)).toBe(true);
  });

  it.each([
    ["Club O2", "Oxygene"],
    ["Dvorana", "Galerija"],
    ["Tvrđa", "Trg"],
    ["HNK Osijek", "HNK Zagreb"],
  ])("keeps %s and %s apart", (a, b) => {
    expect(looksLikeSameVenue(a, b)).toBe(false);
  });

  it("never pairs venues from different cities", () => {
    const groups = venueDuplicateGroups([
      { id: 1, name: "Dom kulture", cityId: 1, cityName: "Osijek" },
      { id: 2, name: "Dom kulture Osijek", cityId: 2, cityName: "Zagreb" },
    ]);
    expect(groups).toEqual([]);
  });

  it("groups a city's near-duplicates and puts the busiest venue first", () => {
    const groups = venueDuplicateGroups([
      { id: 1, name: "Oxygene", cityId: 1, cityName: "Osijek", eventCount: 12 },
      { id: 2, name: "Klub Oxygene", cityId: 1, cityName: "Osijek", eventCount: 3 },
      { id: 3, name: "Tvrđa", cityId: 1, cityName: "Osijek", eventCount: 40 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].venues.map(venue => venue.id)).toEqual([1, 2]);
    expect(groups[0].cityName).toBe("Osijek");
  });

  it("collects three spellings of one place into a single group", () => {
    const groups = venueDuplicateGroups([
      { id: 1, name: "Oxygene", cityId: 1, eventCount: 5 },
      { id: 2, name: "Klub Oxygene", cityId: 1, eventCount: 2 },
      { id: 3, name: "Caffe bar Oxygene", cityId: 1, eventCount: 1 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].venues).toHaveLength(3);
  });

  it("says nothing about a city whose venues are all distinct", () => {
    expect(venueDuplicateGroups([
      { id: 1, name: "Tvrđa", cityId: 1 },
      { id: 2, name: "Kino Urania", cityId: 1 },
    ])).toEqual([]);
  });
});
