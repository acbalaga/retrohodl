export type ErrorCode =
  | "required" | "not_a_number" | "not_positive" | "too_large"
  | "fee_out_of_range" | "periods_out_of_range" | "change_out_of_range"
  | "price_path_invalid" | "target_out_of_range" | "drawdown_out_of_range"
  | "too_many_rows";
export type NoteCode = "blank_rows_ignored";
export interface FieldError<F extends string> {
  field: F;
  code: ErrorCode;
  message: string;
  row?: number; // 0-based index into the original list, for list fields only
}
export interface Note { code: NoteCode; message: string }
export type Outcome<T, F extends string> =
  | { status: "empty"; missing: F[] }
  | { status: "invalid"; errors: FieldError<F>[] }
  | { status: "ok"; value: T; notes: Note[] };
export type Num = number | null; // null = blank, NaN = unparseable
