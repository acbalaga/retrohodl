import { describe, expect, it } from "vitest";
import { calcBreakEven } from "../src/lib/calc/breakeven";
import type { Num } from "../src/lib/calc/types";

const run = (entry: Num, b: Num, s: Num, t: Num) =>
  calcBreakEven({ entryPrice: entry, buyFeePct: b, sellFeePct: s, targetGainPct: t });
const ok = (entry: Num, b: Num, s: Num, t: Num) => {
  const r = run(entry, b, s, t);
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  return r.value;
};
const errs = (entry: Num, b: Num, s: Num, t: Num) => {
  const r = run(entry, b, s, t);
  if (r.status !== "invalid") throw new Error(JSON.stringify(r));
  return r.errors.map((e) => ({ field: e.field, code: e.code }));
};

describe("calcBreakEven", () => {
  it("B1", () => {
    const v = ok(100, 0, 0, null);
    expect(v.breakEvenPrice).toBeCloseTo(100, 9);
    expect(v.breakEvenMovePct).toBeCloseTo(0, 9);
    expect(v.targetPrice).toBeNull();
    expect(v.targetMovePct).toBeNull();
    expect(v.costPerUnitInclBuyFee).toBeCloseTo(100, 9);
  });
  it("B2", () => {
    const v = ok(100, 0.1, 0.1, null);
    expect(v.breakEvenPrice).toBeCloseTo(100.2003004005006, 9);
    expect(v.breakEvenMovePct).toBeCloseTo(0.20030040050058595, 9);
  });
  it("B3", () => {
    const v = ok(100, 1, 1, 10);
    expect(v.costPerUnitInclBuyFee).toBeCloseTo(101.01010101010101, 9);
    expect(v.breakEvenPrice).toBeCloseTo(102.03040506070809, 9);
    expect(v.targetPrice).toBeCloseTo(112.2334455667789, 9);
    expect(v.targetMovePct).toBeCloseTo(12.2334455667789, 9);
  });
  it("B4", () => {
    const v = ok(25000, 0.4, 0.4, 20);
    expect(v.costPerUnitInclBuyFee).toBeCloseTo(25100.4016064257, 6);
    expect(v.targetPrice).toBeCloseTo(30241.447718585183, 6);
  });
  it("B5/B6 targets", () => {
    const a = ok(100, 0, 0, -10);
    expect(a.targetPrice).toBeCloseTo(90, 9);
    expect(a.targetMovePct).toBeCloseTo(-10, 9);
    expect(ok(100, 0, 0, 0).targetPrice).toBeCloseTo(100, 9);
  });
  it("B7 entry null → empty", () => {
    expect(run(null, 0.1, 0.1, 10)).toEqual({ status: "empty", missing: ["entry"] });
  });
  it("B8 entry 0", () => expect(errs(0, 0.1, 0.1, 10)).toEqual([{ field: "entry", code: "not_positive" }]));
  it("B9-B11 fees", () => {
    expect(errs(100, 100, 0, null)).toEqual([{ field: "buyFee", code: "fee_out_of_range" }]);
    expect(errs(100, 0, 100, null)).toEqual([{ field: "sellFee", code: "fee_out_of_range" }]);
    expect(errs(100, -1, 0, null)).toEqual([{ field: "buyFee", code: "fee_out_of_range" }]);
  });
  it("B12-B14 target", () => {
    expect(errs(100, 0, 0, -100)).toEqual([{ field: "target", code: "target_out_of_range" }]);
    expect(errs(100, 0, 0, 10001)).toEqual([{ field: "target", code: "target_out_of_range" }]);
    expect(errs(100, 0, 0, NaN)).toEqual([{ field: "target", code: "not_a_number" }]);
  });
  it("B15 buy fee null → empty", () => {
    expect(run(100, null, 0, null)).toEqual({ status: "empty", missing: ["buyFee"] });
  });
  it("messages", () => {
    const r = run(100, 0, 0, -100);
    expect(r.status === "invalid" && r.errors[0].message).toBe("Target gain must be greater than -100% and no more than 10,000%.");
  });
});
