import { sortEstimateItems, compareEstimateItems } from "./sortEstimateItems";

describe("compareEstimateItems", () => {
    test("numeric values sorted numerically", () => {
        expect(compareEstimateItems("1", "2")).toBeLessThan(0);
        expect(compareEstimateItems("2", "1")).toBeGreaterThan(0);
        expect(compareEstimateItems("1", "1")).toBe(0);
    });

    test("leading zeros handled correctly", () => {
        expect(compareEstimateItems("01", "1")).toBe(0);
        expect(compareEstimateItems("002", "2")).toBe(0);
    });

    test("alphabetical values sorted case-insensitively", () => {
        expect(compareEstimateItems("A", "B")).toBeLessThan(0);
        expect(compareEstimateItems("B", "A")).toBeGreaterThan(0);
        expect(compareEstimateItems("a", "A")).toBe(0);
    });

    test("mixed numeric and alphabetical - numeric comes first", () => {
        expect(compareEstimateItems("1", "A")).toBeLessThan(0);
        expect(compareEstimateItems("A", "1")).toBeGreaterThan(0);
    });

    test("alphanumeric values sorted alphabetically", () => {
        expect(compareEstimateItems("10A", "2B")).toBeGreaterThan(0);
        expect(compareEstimateItems("A1", "B2")).toBeLessThan(0);
    });
});

describe("sortEstimateItems", () => {
    interface TestItem {
        ay?: {
            ay_no?: string | null;
        } | null;
        ay_id?: string | null;
        name: string;
    }

    test("numeric sorting", () => {
        const items: TestItem[] = [
            { ay: { ay_no: "10" }, name: "Item 10" },
            { ay: { ay_no: "2" }, name: "Item 2" },
            { ay: { ay_no: "1" }, name: "Item 1" },
        ];
        const sorted = sortEstimateItems(items);
        expect(sorted.map(i => i.ay?.ay_no)).toEqual(["1", "2", "10"]);
    });

    test("alphabetical sorting", () => {
        const items: TestItem[] = [
            { ay: { ay_no: "C" }, name: "Item C" },
            { ay: { ay_no: "A" }, name: "Item A" },
            { ay: { ay_no: "B" }, name: "Item B" },
        ];
        const sorted = sortEstimateItems(items);
        expect(sorted.map(i => i.ay?.ay_no)).toEqual(["A", "B", "C"]);
    });

    test("mixed numeric and alphabetical sorting", () => {
        const items: TestItem[] = [
            { ay: { ay_no: "10" }, name: "Item 10" },
            { ay: { ay_no: "2" }, name: "Item 2" },
            { ay: { ay_no: "A" }, name: "Item A" },
            { ay: { ay_no: "1" }, name: "Item 1" },
            { ay: { ay_no: "B2" }, name: "Item B2" },
            { ay: { ay_no: "a1" }, name: "Item a1" },
            { ay: { ay_no: "01" }, name: "Item 01" },
        ];
        const sorted = sortEstimateItems(items);
        expect(sorted.map(i => i.ay?.ay_no)).toEqual(["1", "01", "2", "10", "A", "a1", "B2"]);
    });

    test("fallback to ay_id when ay_no is null", () => {
        const items: TestItem[] = [
            { ay: null, ay_id: "2", name: "Item 2" },
            { ay: { ay_no: "1" }, name: "Item 1" },
        ];
        const sorted = sortEstimateItems(items);
        expect(sorted[0].ay?.ay_no).toBe("1");
    });

    test("handles empty array", () => {
        const items: TestItem[] = [];
        const sorted = sortEstimateItems(items);
        expect(sorted).toEqual([]);
    });

    test("stable sort - preserves order for equal values", () => {
        const items: TestItem[] = [
            { ay: { ay_no: "1" }, name: "First" },
            { ay: { ay_no: "1" }, name: "Second" },
        ];
        const sorted = sortEstimateItems(items);
        expect(sorted[0].name).toBe("First");
        expect(sorted[1].name).toBe("Second");
    });
});
