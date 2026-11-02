import { MAX_DD_ROWS, MAX_MONEY } from "./limits";
import { errorMessage, noteMessage } from "./messages";
import type { ErrorCode, FieldError, Note, Num, Outcome } from "./types";

export type DrawdownField = "value" | "drawdowns";
export interface DrawdownInput { positionValue: Num; drawdownsPct: Num[] }
export interface DrawdownRow {
  sourceIndex: number;
  drawdownPct: number;
  valueAfter: number;
  loss: number;
  recoveryGainPct: number | null;
  recoverable: boolean;
}
export interface DrawdownResult { positionValue: number; rows: DrawdownRow[] }

export function calcDrawdown(input: DrawdownInput): Outcome<DrawdownResult, DrawdownField> {
  const errors: FieldError<DrawdownField>[] = [];
  const err = (field: DrawdownField, code: ErrorCode, row?: number, params?: { max?: number }) => {
    const e: FieldError<DrawdownField> = { field, code, message: errorMessage(code, field, params) };
    if (row !== undefined) e.row = row;
    errors.push(e);
  };

  let V: number | undefined;
  const v = input.positionValue;
  if (v === null) err("value", "required");
  else if (Number.isNaN(v)) err("value", "not_a_number");
  else if (v <= 0) err("value", "not_positive");
  else if (v > MAX_MONEY) err("value", "too_large");
  else V = v;

  const list = input.drawdownsPct;
  const kept: { sourceIndex: number; d: number }[] = [];
  const notes: Note[] = [];
  if (list.length > MAX_DD_ROWS) {
    err("drawdowns", "too_many_rows", undefined, { max: MAX_DD_ROWS });
  } else {
    let blanks = 0;
    let bad = false;
    list.forEach((d, i) => {
      if (d === null) blanks++;
      else if (Number.isNaN(d)) (err("drawdowns", "not_a_number", i), (bad = true));
      else if (d < 0 || d > 100) (err("drawdowns", "drawdown_out_of_range", i), (bad = true));
      else kept.push({ sourceIndex: i, d });
    });
    if (kept.length === 0 && !bad) err("drawdowns", "required");
    if (blanks > 0) notes.push({ code: "blank_rows_ignored", message: noteMessage("blank_rows_ignored", { count: blanks }) });
  }

  if (errors.some((e) => e.code !== "required")) return { status: "invalid", errors };
  if (errors.length > 0) {
    const missing: DrawdownField[] = [];
    for (const e of errors) if (!missing.includes(e.field)) missing.push(e.field);
    return { status: "empty", missing };
  }
  if (V === undefined) return { status: "invalid", errors };

  const base = V;
  const rows: DrawdownRow[] = kept.map(({ sourceIndex, d }) => ({
    sourceIndex,
    drawdownPct: d,
    valueAfter: (base * (100 - d)) / 100,
    loss: (base * d) / 100,
    recoveryGainPct: d < 100 ? (d / (100 - d)) * 100 : null,
    recoverable: d < 100,
  }));
  return { status: "ok", notes, value: { positionValue: base, rows } };
}
