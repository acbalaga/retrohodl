export type Currency = "USD" | "PHP" | "EUR";
export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", PHP: "₱", EUR: "€" };

const clean = (x: number): number => (Object.is(x, -0) || x === 0 ? 0 : x);

function digits(a: number): string {
  if (a === 0) return "0.00";
  if (a >= 1) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(a);
  }
  if (a >= 0.01) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: true }).format(a);
  }
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4, maximumFractionDigits: 20, useGrouping: true }).format(a);
}

export function formatMoney(x: number, c: Currency): string {
  const v = clean(x);
  return (v < 0 ? "-" : "") + CURRENCY_SYMBOL[c] + digits(Math.abs(v));
}

export function formatSignedMoney(x: number, c: Currency): string {
  const v = clean(x);
  return (v > 0 ? "+" : "") + formatMoney(v, c);
}

export function formatUnits(x: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 8, useGrouping: true }).format(clean(x));
}

export function formatPct(x: number): string {
  const v = clean(x);
  const body = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(Math.abs(v));
  return (v < 0 && body !== "0.00" ? "-" : "") + body + "%";
}

export function formatSignedPct(x: number): string {
  const v = clean(x);
  const s = formatPct(v);
  return v > 0 ? "+" + s : s;
}
