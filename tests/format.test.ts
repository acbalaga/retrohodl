import { describe, expect, it } from "vitest";
import { formatMoney, formatPct, formatSignedMoney, formatSignedPct, formatUnits } from "../src/lib/format";

describe("format", () => {
  it("formatMoney", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(-50, "PHP")).toBe("-₱50.00");
    expect(formatMoney(0.5, "EUR")).toBe("€0.5000");
    expect(formatMoney(0.00001234, "USD")).toBe("$0.00001234");
    expect(formatMoney(0, "USD")).toBe("$0.00");
    expect(formatMoney(-0, "USD")).toBe("$0.00");
  });
  it("formatSignedMoney", () => {
    expect(formatSignedMoney(230, "USD")).toBe("+$230.00");
    expect(formatSignedMoney(-50, "USD")).toBe("-$50.00");
    expect(formatSignedMoney(0, "USD")).toBe("$0.00");
  });
  it("formatUnits", () => {
    expect(formatUnits(21)).toBe("21");
    expect(formatUnits(20.790000000000003)).toBe("20.79");
    expect(formatUnits(2.7355371900826446)).toBe("2.73553719");
    expect(formatUnits(1234567.123456789)).toBe("1,234,567.12345679");
  });
  it("formatPct / formatSignedPct", () => {
    expect(formatPct(57.49999999999999)).toBe("57.50%");
    expect(formatPct(9900)).toBe("9,900.00%");
    expect(formatSignedPct(10.333333333333334)).toBe("+10.33%");
    expect(formatSignedPct(-25)).toBe("-25.00%");
    expect(formatSignedPct(0)).toBe("0.00%");
  });
});
