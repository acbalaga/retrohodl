import { describe, expect, it } from "vitest";
import { calcDrawdown } from "../src/lib/calc/drawdown";
import type { Num } from "../src/lib/calc/types";

const ok = (value: Num, pcts: Num[]) => {
  const r = calcDrawdown({ positionValue: value, drawdownsPct: pcts });
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  return r;
};
const errs = (value: Num, pcts: Num[]) => {
  const r = calcDrawdown({ positionValue: value, drawdownsPct: pcts });
  if (r.status !== "invalid") throw new Error(JSON.stringify(r));
  return r.errors;
};

describe("calcDrawdown", () => {
  it("W1", () => {
    const { rows } = ok(1000, [10, 20, 50, 75, 90, 100]).value;
    [900, 800, 500, 250, 100, 0].forEach((x, i) => expect(rows[i].valueAfter).toBeCloseTo(x, 9));
    [100, 200, 500, 750, 900, 1000].forEach((x, i) => expect(rows[i].loss).toBeCloseTo(x, 9));
    [11.11111111111111, 25, 100, 300, 900].forEach((x, i) => expect(rows[i].recoveryGainPct).toBeCloseTo(x, 9));
    expect(rows[5].recoveryGainPct).toBeNull();
    expect(rows.map((r) => r.recoverable)).toEqual([true, true, true, true, true, false]);
  });
  it("W2 zero drawdown", () => {
    const r = ok(1000, [0]).value.rows[0];
    expect(r.valueAfter).toBeCloseTo(1000, 9);
    expect(r.loss).toBeCloseTo(0, 9);
    expect(r.recoveryGainPct).toBeCloseTo(0, 9);
  });
  it("W3 99%", () => {
    const r = ok(1000, [99]).value.rows[0];
    expect(r.valueAfter).toBeCloseTo(10, 9);
    expect(r.recoveryGainPct).toBeCloseTo(9900, 6);
  });
  it("W4 blank row", () => {
    const r = ok(1000, [10, null, 20]);
    expect(r.value.rows.map((x) => x.sourceIndex)).toEqual([0, 2]);
    expect(r.notes[0].message).toBe("1 blank row ignored.");
  });
  it("W5 order preserved", () => {
    expect(ok(1000, [20, 10]).value.rows.map((x) => x.drawdownPct)).toEqual([20, 10]);
  });
  it("W6/W7 range", () => {
    for (const d of [-5, 100.01]) {
      expect(errs(1000, [d]).map((e) => [e.field, e.code, e.row])).toEqual([["drawdowns", "drawdown_out_of_range", 0]]);
    }
    expect(errs(1000, [-5])[0].message).toBe("Drawdown must be from 0% to 100%.");
  });
  it("W8 value 0", () => expect(errs(0, [10]).map((e) => [e.field, e.code])).toEqual([["value", "not_positive"]]));
  it("W9 value null", () => {
    expect(calcDrawdown({ positionValue: null, drawdownsPct: [10] })).toEqual({ status: "empty", missing: ["value"] });
  });
  it("W10 only blanks", () => {
    expect(calcDrawdown({ positionValue: 1000, drawdownsPct: [null, null] })).toEqual({ status: "empty", missing: ["drawdowns"] });
  });
  it("W11 too many", () => {
    const e = errs(1000, Array(21).fill(10));
    expect(e.map((x) => x.code)).toEqual(["too_many_rows"]);
    expect(e[0].message).toBe("Use at most 20 rows.");
  });
  it("W12 NaN", () => {
    expect(errs(1000, [NaN]).map((e) => [e.field, e.code, e.row])).toEqual([["drawdowns", "not_a_number", 0]]);
  });
});
