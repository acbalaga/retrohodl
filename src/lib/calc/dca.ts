import {
  MAX_CHANGE_PCT, MAX_DCA_ROWS, MAX_MONEY, MAX_PATH_PRICE, MAX_PERIODS, MIN_PATH_PRICE, ZERO_EPS_REL,
} from "./limits";
import { errorMessage, noteMessage } from "./messages";
import type { ErrorCode, FieldError, Note, Num, Outcome } from "./types";

export type DcaField = "amount" | "fee" | "final" | "start" | "change" | "periods" | "prices";
export type DcaPriceSource =
  | { mode: "growth"; start: Num; changePct: Num; periods: Num }
  | { mode: "list"; prices: Num[] };
export interface DcaInput { amount: Num; feePct: Num; finalPrice: Num; source: DcaPriceSource }
export interface DcaRow {
  period: number; // 1-based
  price: number;
  spent: number;
  fee: number;
  units: number;
  cumUnits: number;
  cumInvested: number;
  avgCost: number;
}
export interface DcaResult {
  periods: number;
  totalInvested: number;
  totalFees: number;
  netInvested: number;
  unitsAcquired: number;
  avgCostInclFees: number;
  avgPriceExclFees: number;
  finalPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  rows: DcaRow[];
}

export function buildGrowthPrices(start: number, changePct: number, periods: number): number[] {
  const g = changePct / 100;
  const out: number[] = [];
  for (let i = 1; i <= periods; i++) out.push(start * Math.pow(1 + g, i - 1));
  return out;
}

export function calcDca(input: DcaInput): Outcome<DcaResult, DcaField> {
  const errors: FieldError<DcaField>[] = [];
  const err = (field: DcaField, code: ErrorCode, row?: number, params?: { max?: number }) => {
    const e: FieldError<DcaField> = { field, code, message: errorMessage(code, field, params) };
    if (row !== undefined) e.row = row;
    errors.push(e);
  };

  /** Positive money field: null → required, NaN → not_a_number, <=0 → not_positive, >MAX → too_large. */
  const money = (field: DcaField, v: Num): number | undefined => {
    if (v === null) return err(field, "required"), undefined;
    if (Number.isNaN(v)) return err(field, "not_a_number"), undefined;
    if (v <= 0) return err(field, "not_positive"), undefined;
    if (v > MAX_MONEY) return err(field, "too_large"), undefined;
    return v;
  };

  const A = money("amount", input.amount);

  let f: number | undefined;
  const fee = input.feePct;
  if (fee === null) err("fee", "required");
  else if (Number.isNaN(fee)) err("fee", "not_a_number");
  else if (fee < 0 || fee >= 100) err("fee", "fee_out_of_range");
  else f = fee / 100;

  const Pf = money("final", input.finalPrice);

  let prices: number[] | undefined;
  const notes: Note[] = [];

  const src = input.source;
  if (src.mode === "growth") {
    const S = money("start", src.start);

    let chg: number | undefined;
    if (src.changePct === null) err("change", "required");
    else if (Number.isNaN(src.changePct)) err("change", "not_a_number");
    else if (src.changePct <= -100 || src.changePct > MAX_CHANGE_PCT) err("change", "change_out_of_range");
    else chg = src.changePct;

    let n: number | undefined;
    if (src.periods === null) err("periods", "required");
    else if (Number.isNaN(src.periods)) err("periods", "not_a_number");
    else if (!Number.isInteger(src.periods) || src.periods < 1 || src.periods > MAX_PERIODS) {
      err("periods", "periods_out_of_range");
    } else n = src.periods;

    if (S !== undefined && chg !== undefined && n !== undefined) {
      const path = buildGrowthPrices(S, chg, n);
      if (path.some((p) => !Number.isFinite(p) || p < MIN_PATH_PRICE || p > MAX_PATH_PRICE)) {
        err("change", "price_path_invalid");
      } else prices = path;
    }
  } else {
    const list = src.prices;
    if (list.length > MAX_DCA_ROWS) {
      err("prices", "too_many_rows", undefined, { max: MAX_DCA_ROWS });
    } else {
      const ok: number[] = [];
      let blanks = 0;
      let bad = false;
      list.forEach((v, i) => {
        if (v === null) blanks++;
        else if (Number.isNaN(v)) (err("prices", "not_a_number", i), (bad = true));
        else if (v <= 0) (err("prices", "not_positive", i), (bad = true));
        else if (v > MAX_MONEY) (err("prices", "too_large", i), (bad = true));
        else ok.push(v);
      });
      if (ok.length === 0 && !bad) err("prices", "required");
      if (blanks > 0) notes.push({ code: "blank_rows_ignored", message: noteMessage("blank_rows_ignored", { count: blanks }) });
      if (!bad) prices = ok;
    }
  }

  if (errors.some((e) => e.code !== "required")) return { status: "invalid", errors };
  if (errors.length > 0) {
    const missing: DcaField[] = [];
    for (const e of errors) if (!missing.includes(e.field)) missing.push(e.field);
    return { status: "empty", missing };
  }
  if (A === undefined || f === undefined || Pf === undefined || prices === undefined) {
    // unreachable once validation passes
    return { status: "invalid", errors };
  }

  const n = prices.length;
  const rows: DcaRow[] = [];
  let cumUnits = 0;
  for (let i = 0; i < n; i++) {
    const units = (A * (1 - f)) / prices[i];
    cumUnits += units;
    const cumInvested = (i + 1) * A;
    rows.push({
      period: i + 1,
      price: prices[i],
      spent: A,
      fee: A * f,
      units,
      cumUnits,
      cumInvested,
      avgCost: cumInvested / cumUnits,
    });
  }
  const totalInvested = n * A;
  const totalFees = n * A * f;
  const netInvested = totalInvested - totalFees;
  const unitsAcquired = cumUnits;
  const currentValue = unitsAcquired * Pf;
  let pnl = currentValue - totalInvested;
  let pnlPct = (pnl / totalInvested) * 100;
  if (Math.abs(pnl) < ZERO_EPS_REL * totalInvested) {
    pnl = 0;
    pnlPct = 0;
  }
  return {
    status: "ok",
    notes,
    value: {
      periods: n,
      totalInvested,
      totalFees,
      netInvested,
      unitsAcquired,
      avgCostInclFees: totalInvested / unitsAcquired,
      avgPriceExclFees: netInvested / unitsAcquired,
      finalPrice: Pf,
      currentValue,
      pnl,
      pnlPct,
      rows,
    },
  };
}
