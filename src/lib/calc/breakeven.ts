import { MAX_MONEY, MAX_TARGET_PCT } from "./limits";
import { errorMessage } from "./messages";
import type { ErrorCode, FieldError, Num, Outcome } from "./types";

export type BreakEvenField = "entry" | "buyFee" | "sellFee" | "target";
export interface BreakEvenInput { entryPrice: Num; buyFeePct: Num; sellFeePct: Num; targetGainPct: Num }
export interface BreakEvenResult {
  costPerUnitInclBuyFee: number;
  breakEvenPrice: number;
  breakEvenMovePct: number;
  targetGainPct: number | null;
  targetPrice: number | null;
  targetMovePct: number | null;
}

export function calcBreakEven(input: BreakEvenInput): Outcome<BreakEvenResult, BreakEvenField> {
  const errors: FieldError<BreakEvenField>[] = [];
  const err = (field: BreakEvenField, code: ErrorCode) =>
    errors.push({ field, code, message: errorMessage(code, field) });

  let P: number | undefined;
  const e = input.entryPrice;
  if (e === null) err("entry", "required");
  else if (Number.isNaN(e)) err("entry", "not_a_number");
  else if (e <= 0) err("entry", "not_positive");
  else if (e > MAX_MONEY) err("entry", "too_large");
  else P = e;

  const fee = (field: BreakEvenField, v: Num): number | undefined => {
    if (v === null) return err(field, "required"), undefined;
    if (Number.isNaN(v)) return err(field, "not_a_number"), undefined;
    if (v < 0 || v >= 100) return err(field, "fee_out_of_range"), undefined;
    return v / 100;
  };
  const fb = fee("buyFee", input.buyFeePct);
  const fs = fee("sellFee", input.sellFeePct);

  let g: number | null = null;
  const t = input.targetGainPct;
  if (t !== null) {
    if (Number.isNaN(t)) err("target", "not_a_number");
    else if (t <= -100 || t > MAX_TARGET_PCT) err("target", "target_out_of_range");
    else g = t;
  }

  if (errors.some((x) => x.code !== "required")) return { status: "invalid", errors };
  if (errors.length > 0) return { status: "empty", missing: errors.map((x) => x.field) };
  if (P === undefined || fb === undefined || fs === undefined) return { status: "invalid", errors };

  const denom = (1 - fb) * (1 - fs);
  const breakEvenPrice = P / denom;
  const targetPrice = g === null ? null : (P * (1 + g / 100)) / denom;
  return {
    status: "ok",
    notes: [],
    value: {
      costPerUnitInclBuyFee: P / (1 - fb),
      breakEvenPrice,
      breakEvenMovePct: (breakEvenPrice / P - 1) * 100,
      targetGainPct: g,
      targetPrice,
      targetMovePct: targetPrice === null ? null : (targetPrice / P - 1) * 100,
    },
  };
}
