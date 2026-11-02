import { describe, expect, it } from "vitest";
import { parseDecimal, toCalcInput } from "../src/lib/parse";
import { errorMessage } from "../src/lib/calc/messages";

const ok = (value: number, normalized: string) => ({ kind: "ok", value, normalized });

describe("parseDecimal", () => {
  it("empty", () => {
    expect(parseDecimal("")).toEqual({ kind: "empty" });
    expect(parseDecimal("   ")).toEqual({ kind: "empty" });
  });
  it.each([
    ["1250.50", 1250.5, "1250.50"],
    ["1,250.50", 1250.5, "1250.50"],
    [" 1 000 ", 1000, "1000"],
    ["+5", 5, "5"],
    ["5.", 5, "5"],
    [".5", 0.5, "0.5"],
    ["-.5", -0.5, "-0.5"],
    ["−2", -2, "-2"],
    ["-0", 0, "0"],
  ])("ok %s", (raw, value, normalized) => {
    expect(parseDecimal(raw)).toEqual(ok(value, normalized));
  });
  it("-0 is a positive zero", () => {
    const r = parseDecimal("-0");
    expect(r.kind === "ok" && Object.is(r.value, 0)).toBe(true);
  });
  it.each(["abc", "1.2.3", "1e5", "$100", "10%", "-", ".", "1".repeat(25), "1000000000000000"])(
    "invalid %s",
    (raw) => {
      expect(parseDecimal(raw)).toEqual({ kind: "invalid" });
    },
  );
  it("toCalcInput", () => {
    expect(toCalcInput({ kind: "empty" })).toBeNull();
    expect(toCalcInput({ kind: "invalid" })).toBeNaN();
    expect(toCalcInput({ kind: "ok", value: 3, normalized: "3" })).toBe(3);
  });
});

describe("messages (T4 smoke)", () => {
  it("too_many_rows substitutes max", () => {
    expect(errorMessage("too_many_rows", "prices", { max: 120 })).toBe("Use at most 120 rows.");
  });
});
