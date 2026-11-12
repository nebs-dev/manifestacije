import { normalizeCountyName } from "../src/common/croatia-geo";

/**
 * Regressions for the findings the first CodeQL scan raised that turned out to
 * be real. Each test states what was wrong, so a later edit that reintroduces
 * it fails here rather than in a scan weeks later.
 */

describe("normalizeCountyName is linear in its input (CodeQL js/polynomial-redos)", () => {
  /**
   * `/\s+County$/i` was quadratic on a run of spaces — measured at 245ms for
   * 20k, 4s for 80k, 25s for 200k. countyName arrives from the admin event
   * body, which carries no length bound, and from a geocoding provider's
   * response. A budget rather than an exact time: the point is the shape of
   * the curve, not the speed of the machine.
   */
  it.each([50_000, 200_000, 500_000])("handles %i trailing spaces well inside a budget", (size) => {
    const started = Date.now();
    normalizeCountyName(`Osječko-baranjska${" ".repeat(size)}!`);
    expect(Date.now() - started).toBeLessThan(250);
  });

  it("still strips the suffixes it always did", () => {
    expect(normalizeCountyName("Osječko-baranjska županija")).toBe("Osječko-baranjska");
    expect(normalizeCountyName("Split-Dalmatia County")).toBe("Split-Dalmatia");
    expect(normalizeCountyName("Split-Dalmatia   County")).toBe("Split-Dalmatia");
    expect(normalizeCountyName("  Zadarska županija  ")).toBe("Zadarska");
  });

  it("leaves a name that merely ends in the word, with no space before it", () => {
    expect(normalizeCountyName("GrandCounty")).toBe("GrandCounty");
  });

  it("maps a known alias after stripping", () => {
    expect(normalizeCountyName("Osijek-Baranja County")).toBe("Osječko-baranjska");
  });
});
