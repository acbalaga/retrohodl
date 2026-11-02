import { describe, expect, it } from "vitest";
import { buildGrowthPrices, calcDca } from "../src/lib/calc/dca";
import type { DcaInput } from "../src/lib/calc/dca";
import { errorMessage } from "../src/lib/calc/messages";

const D1: DcaInput = { amount: 100, feePct: 0, finalPrice: 30, source: { mode: "list", prices: [10, 20, 25, 50] } };
const withList = (prices: (number | null)[], over: Partial<DcaInput> = {}): DcaInput => ({
  ...D1, ...over, source: { mode: "list", prices },
});
const growth = (start: number | null, changePct: number | null, periods: number | null, over: Partial<DcaInput> = {}): DcaInput => ({
  amount: 100, feePct: 0, finalPrice: 100, ...over, source: { mode: "growth", start, changePct, periods },
});
const ok = (i: DcaInput) => {
  const r = calcDca(i);
  if (r.status !== "ok") throw new Error("expected ok, got " + JSON.stringify(r));
  return r;
};
const close = (a: number, b: number, d = 9) => expect(a).toBeCloseTo(b, d);
const invalid = (i: DcaInput) => {
  const r = calcDca(i);
  if (r.status !== "invalid") throw new Error("expected invalid, got " + JSON.stringify(r));
  return r.errors.map((e) => ({ field: e.field, code: e.code, ...(e.row !== undefined ? { row: e.row } : {}) }));
};

describe("calcDca results", () => {
  it("D1 list, no fee, gain", () => {
    const { value: v } = ok(D1);
    expect(v.periods).toBe(4);
    close(v.totalInvested, 400); close(v.totalFees, 0); close(v.unitsAcquired, 21);
    close(v.avgCostInclFees, 19.047619047619047); close(v.avgPriceExclFees, 19.047619047619047);
    close(v.currentValue, 630); close(v.pnl, 230); close(v.pnlPct, 57.5);
    close(v.rows[1].cumUnits, 15); close(v.rows[1].cumInvested, 200); close(v.rows[1].avgCost, 13.333333333333334);
  });
  it("D2 list, 1% fee", () => {
    const { value: v } = ok({ ...D1, feePct: 1 });
    close(v.totalFees, 4); close(v.netInvested, 396); close(v.unitsAcquired, 20.79);
    close(v.avgCostInclFees, 19.240019240019237); close(v.avgPriceExclFees, 19.047619047619047);
    close(v.currentValue, 623.7); close(v.pnl, 223.7); close(v.pnlPct, 55.925);
    close(v.rows[0].fee, 1); close(v.rows[0].units, 9.9);
  });
  it("D3 loss", () => {
    const { value: v } = ok(withList([10, 20], { finalPrice: 10 }));
    close(v.unitsAcquired, 15); close(v.totalInvested, 200); close(v.avgCostInclFees, 13.333333333333334);
    close(v.currentValue, 150); close(v.pnl, -50); close(v.pnlPct, -25);
  });
  it("D4 growth +10%", () => {
    const { value: v } = ok(growth(100, 10, 3, { finalPrice: 121 }));
    [100, 110, 121].forEach((p, i) => close(v.rows[i].price, p));
    close(v.unitsAcquired, 2.7355371900826446); close(v.avgCostInclFees, 109.66767371601209);
    close(v.currentValue, 331); close(v.pnl, 31); close(v.pnlPct, 10.333333333333334);
  });
  it("D5 growth -50% with fee", () => {
    const { value: v } = ok(growth(100, -50, 2, { feePct: 0.5, finalPrice: 80 }));
    close(v.rows[0].price, 100); close(v.rows[1].price, 50);
    close(v.totalInvested, 200); close(v.totalFees, 1); close(v.unitsAcquired, 2.985);
    close(v.avgCostInclFees, 67.00167504187606); close(v.avgPriceExclFees, 66.66666666666667);
    close(v.currentValue, 238.8); close(v.pnl, 38.8); close(v.pnlPct, 19.4);
  });
  it("D6 snap to zero", () => {
    const { value: v } = ok(withList([7, 7, 7, 7, 7, 7, 7], { finalPrice: 7 }));
    expect(v.pnl).toBe(0);
    expect(v.pnlPct).toBe(0);
  });
  it("D7 blank rows", () => {
    const r = ok(withList([null, 10, null, 20], { finalPrice: 20 }));
    expect(r.value.periods).toBe(2);
    close(r.value.unitsAcquired, 15);
    expect(r.notes).toEqual([{ code: "blank_rows_ignored", message: "2 blank rows ignored." }]);
  });
  it("D8 one blank row", () => {
    expect(ok(withList([10, null])).notes[0].message).toBe("1 blank row ignored.");
  });
  it("D31 list mode ignores growth fields", () => {
    expect(ok({ ...D1, source: { mode: "list", prices: [10, 20] } }).status).toBe("ok");
  });
  it("D32 flat growth", () => {
    const { value: v } = ok(growth(100, 0, 12));
    expect(v.pnl).toBe(0);
    close(v.unitsAcquired, 12);
    expect(v.rows.every((r) => r.price === 100)).toBe(true);
  });
  it("buildGrowthPrices", () => {
    const p = buildGrowthPrices(100, 10, 3);
    [100, 110.00000000000001, 121.00000000000001].forEach((x, i) => close(p[i], x));
  });
});

describe("calcDca validation", () => {
  it("D9 amount null → empty", () => {
    expect(calcDca({ ...D1, amount: null })).toEqual({ status: "empty", missing: ["amount"] });
  });
  it("D10/D11 amount not positive", () => {
    expect(invalid({ ...D1, amount: 0 })).toEqual([{ field: "amount", code: "not_positive" }]);
    expect(invalid({ ...D1, amount: -5 })).toEqual([{ field: "amount", code: "not_positive" }]);
  });
  it("D12 NaN", () => expect(invalid({ ...D1, amount: NaN })).toEqual([{ field: "amount", code: "not_a_number" }]));
  it("D13 too large", () => expect(invalid({ ...D1, amount: 1e12 + 1 })).toEqual([{ field: "amount", code: "too_large" }]));
  it("D14-16 fee", () => {
    expect(invalid({ ...D1, feePct: 100 })).toEqual([{ field: "fee", code: "fee_out_of_range" }]);
    expect(invalid({ ...D1, feePct: -0.1 })).toEqual([{ field: "fee", code: "fee_out_of_range" }]);
    expect(calcDca({ ...D1, feePct: 0 }).status).toBe("ok");
  });
  it("D17 final 0", () => expect(invalid({ ...D1, finalPrice: 0 })).toEqual([{ field: "final", code: "not_positive" }]));
  it("D18/D19 empty list", () => {
    expect(calcDca(withList([null, null]))).toEqual({ status: "empty", missing: ["prices"] });
    expect(calcDca(withList([]))).toEqual({ status: "empty", missing: ["prices"] });
  });
  it("D20 zero price row", () => expect(invalid(withList([10, 0]))).toEqual([{ field: "prices", code: "not_positive", row: 1 }]));
  it("D21 multiple row errors", () => {
    expect(invalid(withList([10, NaN, -3]))).toEqual([
      { field: "prices", code: "not_a_number", row: 1 },
      { field: "prices", code: "not_positive", row: 2 },
    ]);
  });
  it("D22 too many rows", () => {
    const r = calcDca(withList(Array(121).fill(10)));
    expect(r.status).toBe("invalid");
    if (r.status === "invalid") {
      expect(r.errors.map((e) => e.code)).toEqual(["too_many_rows"]);
      expect(r.errors[0].message).toBe("Use at most 120 rows.");
    }
  });
  it("D23 required + range error together → invalid", () => {
    expect(invalid({ ...D1, amount: null, feePct: 150 })).toEqual([
      { field: "amount", code: "required" },
      { field: "fee", code: "fee_out_of_range" },
    ]);
  });
  it("D24-26 periods", () => {
    for (const n of [0, 2.5, 601]) expect(invalid(growth(100, 0, n))).toEqual([{ field: "periods", code: "periods_out_of_range" }]);
  });
  it("D27/D28 change", () => {
    expect(invalid(growth(100, -100, 3))).toEqual([{ field: "change", code: "change_out_of_range" }]);
    expect(invalid(growth(100, 1000.01, 3))).toEqual([{ field: "change", code: "change_out_of_range" }]);
  });
  it("D29/D30 price path", () => {
    expect(invalid(growth(100, -99, 600))).toEqual([{ field: "change", code: "price_path_invalid" }]);
    expect(invalid(growth(100, 1000, 600))).toEqual([{ field: "change", code: "price_path_invalid" }]);
  });
  it("messages match section 2.4", () => {
    const m = (i: DcaInput) => {
      const r = calcDca(i);
      return r.status === "invalid" ? r.errors[0].message : "";
    };
    expect(m({ ...D1, amount: 0 })).toBe("Must be greater than 0.");
    expect(m({ ...D1, amount: NaN })).toBe("Enter a number using digits and a dot for decimals, e.g. 1250.50.");
    expect(m({ ...D1, amount: 1e13 })).toBe("Must be 1,000,000,000,000 or less.");
    expect(m({ ...D1, feePct: 100 })).toBe("Fee must be 0% or more and less than 100%.");
    expect(m(growth(100, 0, 0))).toBe("Enter a whole number from 1 to 600.");
    expect(m(growth(100, -100, 3))).toBe("Change must be greater than -100% and no more than 1,000%.");
    expect(m(growth(100, -99, 600))).toBe(errorMessage("price_path_invalid"));
    expect(m({ ...D1, amount: null, feePct: 150 })).toBe("Enter a value.");
  });
  it("empty prices message", () => {
    expect(errorMessage("required", "prices")).toBe("Add at least one price.");
  });
});
