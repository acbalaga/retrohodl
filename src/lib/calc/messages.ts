import type { ErrorCode, NoteCode } from "./types";

const MESSAGES: Record<ErrorCode, string> = {
  required: "Enter a value.",
  not_a_number: "Enter a number using digits and a dot for decimals, e.g. 1250.50.",
  not_positive: "Must be greater than 0.",
  too_large: "Must be 1,000,000,000,000 or less.",
  fee_out_of_range: "Fee must be 0% or more and less than 100%.",
  periods_out_of_range: "Enter a whole number from 1 to 600.",
  change_out_of_range: "Change must be greater than -100% and no more than 1,000%.",
  price_path_invalid:
    "With this start price and change, some prices fall below 0.000000000001 or rise above 1,000,000,000,000,000. Use fewer periods or a smaller change.",
  target_out_of_range: "Target gain must be greater than -100% and no more than 10,000%.",
  drawdown_out_of_range: "Drawdown must be from 0% to 100%.",
  too_many_rows: "Use at most {max} rows.",
};

export function errorMessage(code: ErrorCode, field?: string, params?: { max?: number }): string {
  if (code === "required") {
    if (field === "prices") return "Add at least one price.";
    if (field === "drawdowns") return "Add at least one drawdown %.";
  }
  return MESSAGES[code].replace("{max}", String(params?.max ?? ""));
}

export function noteMessage(code: NoteCode, params: { count: number }): string {
  // only one note code exists
  void code;
  return params.count === 1 ? "1 blank row ignored." : `${params.count} blank rows ignored.`;
}
