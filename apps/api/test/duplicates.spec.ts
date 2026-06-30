import { DuplicatesService } from "../src/duplicates/duplicates.service";

describe("DuplicatesService", () => {
  it("scores similar titles through private helper", () => {
    const service = new DuplicatesService({} as never);
    const score = (service as unknown as { titleSimilarity(a: string, b: string): number }).titleSimilarity("Osijek wine night", "Osijek wine evening");
    expect(score).toBeGreaterThan(0.5);
  });
});
