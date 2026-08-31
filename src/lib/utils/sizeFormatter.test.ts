import { normalizeSize, validateSize, calculateSizeFromString, SIZE_ERROR_MESSAGE } from "./sizeFormatter";

describe("normalizeSize", () => {
    test("converts * to x", () => {
        expect(normalizeSize("10*12")).toBe("10x12");
        expect(normalizeSize("5*7*9")).toBe("5x7x9");
    });

    test("converts uppercase X to lowercase x", () => {
        expect(normalizeSize("10X12")).toBe("10x12");
        expect(normalizeSize("5X7X9")).toBe("5x7x9");
    });

    test("trims whitespace", () => {
        expect(normalizeSize(" 10x12 ")).toBe("10x12");
        expect(normalizeSize("  5x7x9  ")).toBe("5x7x9");
    });

    test("handles null/undefined/empty", () => {
        expect(normalizeSize(null)).toBe("");
        expect(normalizeSize(undefined)).toBe("");
        expect(normalizeSize("")).toBe("");
    });
});

describe("validateSize", () => {
    test("valid formats return true", () => {
        expect(validateSize("10x12")).toBe(true);
        expect(validateSize("5x7x9")).toBe(true);
        expect(validateSize("8")).toBe(true);
        expect(validateSize("10*12")).toBe(true); // after normalization
    });

    test("invalid formats return false", () => {
        expect(validateSize("10-12")).toBe(false);
        expect(validateSize("abc")).toBe(false);
        expect(validateSize("10 x 12")).toBe(false);
        expect(validateSize("x12")).toBe(false);
        expect(validateSize("12x")).toBe(false);
    });

    test("empty returns false", () => {
        expect(validateSize("")).toBe(false);
        expect(validateSize(null)).toBe(false);
        expect(validateSize(undefined)).toBe(false);
    });
});

describe("calculateSizeFromString", () => {
    test("single number returns value", () => {
        expect(calculateSizeFromString("10")).toBe(10);
        expect(calculateSizeFromString("90")).toBe(90);
    });

    test("x-separated dimensions multiply", () => {
        expect(calculateSizeFromString("10x12")).toBe(120);
        expect(calculateSizeFromString("5x7x9")).toBe(315);
    });

    test("* separator also works after normalization", () => {
        expect(calculateSizeFromString("10*12")).toBe(120);
        expect(calculateSizeFromString("5*7*9")).toBe(315);
    });

    test("returns 0 for invalid input", () => {
        expect(calculateSizeFromString("")).toBe(0);
        expect(calculateSizeFromString("abc")).toBe(0);
        expect(calculateSizeFromString("10-12")).toBe(0);
        expect(calculateSizeFromString(null)).toBe(0);
        expect(calculateSizeFromString(undefined)).toBe(0);
    });

    test("returns 0 when contains zero", () => {
        expect(calculateSizeFromString("10x0")).toBe(0);
        expect(calculateSizeFromString("0x12")).toBe(0);
    });
});

describe("SIZE_ERROR_MESSAGE", () => {
    test("has correct message", () => {
        expect(SIZE_ERROR_MESSAGE).toBe("Invalid size format. Use numbers and 'x' only (e.g., 10x12)");
    });
});