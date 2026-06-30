"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const duplicates_service_1 = require("../src/duplicates/duplicates.service");
describe("DuplicatesService", () => {
    it("scores similar titles through private helper", () => {
        const service = new duplicates_service_1.DuplicatesService({});
        const score = service.titleSimilarity("Osijek wine night", "Osijek wine evening");
        expect(score).toBeGreaterThan(0.5);
    });
});
