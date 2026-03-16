import { describe, expect, it } from "vitest";
import { WORD_BANK } from "../src/core/wordBank.js";
describe("wordBank", () => {
    it("contains at least 300 word pairs", () => {
        expect(WORD_BANK.length).toBeGreaterThanOrEqual(300);
    });
    it("covers required categories", () => {
        const categories = new Set(WORD_BANK.map((item) => item.category));
        expect(categories.has("food")).toBe(true);
        expect(categories.has("animals")).toBe(true);
        expect(categories.has("jobs")).toBe(true);
        expect(categories.has("movies")).toBe(true);
        expect(categories.has("dailyObjects")).toBe(true);
    });
});
