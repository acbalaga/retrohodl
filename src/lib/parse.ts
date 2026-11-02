export type ParsedNumber =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "ok"; value: number; normalized: string };

const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/** Parse what a user typed. `.` is the decimal separator; grouping characters are stripped. */
export function parseDecimal(raw: string): ParsedNumber {
  let s = raw.trim();
  if (s === "") return { kind: "empty" };
  s = s.replace(/−/g, "-");
  s = s.replace(/[\s,_']/g, "");
  if (s.length > 24) return { kind: "invalid" };
  if (!NUMBER_RE.test(s)) return { kind: "invalid" };
  if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith(".")) s = s.slice(0, -1);
  if (s.startsWith(".")) s = "0" + s;
  if (s.startsWith("-.")) s = "-0" + s.slice(1);
  let value = Number(s);
  if (!Number.isFinite(value) || Math.abs(value) >= 1e15) return { kind: "invalid" };
  if (value === 0 && s.startsWith("-")) {
    s = s.slice(1);
    value = 0;
  }
  return { kind: "ok", value, normalized: s };
}

/** empty → null, invalid → NaN, ok → value */
export function toCalcInput(p: ParsedNumber): number | null {
  if (p.kind === "empty") return null;
  if (p.kind === "invalid") return Number.NaN;
  return p.value;
}
