import type { Currency } from "./format";
import { parseDecimal } from "./parse";

export type TabId = "dca" | "be" | "dd";
export interface AppState {
  tab: TabId;
  currency: Currency;
  dca: {
    amount: string; fee: string; mode: "growth" | "list"; periods: string;
    start: string; change: string; prices: string[]; final: string;
  };
  be: { entry: string; buyFee: string; sellFee: string; target: string };
  dd: { value: string; pcts: string[] };
}

export const DEFAULT_STATE: AppState = {
  tab: "dca",
  currency: "USD",
  dca: { amount: "100", fee: "0.1", mode: "growth", periods: "12", start: "100", change: "-2", prices: [], final: "100" },
  be: { entry: "100", buyFee: "0.1", sellFee: "0.1", target: "10" },
  dd: { value: "10000", pcts: ["10", "20", "30", "50", "75", "90"] },
};

export const MAX_URL_LENGTH = 8000;
const DCA_LIST_MAX = 120;
const DD_LIST_MAX = 20;

export function cloneState(s: AppState): AppState {
  return {
    tab: s.tab,
    currency: s.currency,
    dca: { ...s.dca, prices: [...s.dca.prices] },
    be: { ...s.be },
    dd: { value: s.dd.value, pcts: [...s.dd.pcts] },
  };
}

type Spec =
  | { key: string; kind: "enum"; allowed: readonly string[]; get: (s: AppState) => string; set: (s: AppState, v: string) => void }
  | { key: string; kind: "number"; get: (s: AppState) => string; set: (s: AppState, v: string) => void }
  | { key: string; kind: "list"; max: number; get: (s: AppState) => string[]; set: (s: AppState, v: string[]) => void };

/** Table order is the serialization order. */
const SPECS: Spec[] = [
  { key: "tab", kind: "enum", allowed: ["dca", "be", "dd"], get: (s) => s.tab, set: (s, v) => { s.tab = v as TabId; } },
  { key: "cur", kind: "enum", allowed: ["USD", "PHP", "EUR"], get: (s) => s.currency, set: (s, v) => { s.currency = v as Currency; } },
  { key: "dca_amt", kind: "number", get: (s) => s.dca.amount, set: (s, v) => { s.dca.amount = v; } },
  { key: "dca_fee", kind: "number", get: (s) => s.dca.fee, set: (s, v) => { s.dca.fee = v; } },
  { key: "dca_mode", kind: "enum", allowed: ["growth", "list"], get: (s) => s.dca.mode, set: (s, v) => { s.dca.mode = v as "growth" | "list"; } },
  { key: "dca_n", kind: "number", get: (s) => s.dca.periods, set: (s, v) => { s.dca.periods = v; } },
  { key: "dca_start", kind: "number", get: (s) => s.dca.start, set: (s, v) => { s.dca.start = v; } },
  { key: "dca_chg", kind: "number", get: (s) => s.dca.change, set: (s, v) => { s.dca.change = v; } },
  { key: "dca_prices", kind: "list", max: DCA_LIST_MAX, get: (s) => s.dca.prices, set: (s, v) => { s.dca.prices = v; } },
  { key: "dca_final", kind: "number", get: (s) => s.dca.final, set: (s, v) => { s.dca.final = v; } },
  { key: "be_entry", kind: "number", get: (s) => s.be.entry, set: (s, v) => { s.be.entry = v; } },
  { key: "be_bfee", kind: "number", get: (s) => s.be.buyFee, set: (s, v) => { s.be.buyFee = v; } },
  { key: "be_sfee", kind: "number", get: (s) => s.be.sellFee, set: (s, v) => { s.be.sellFee = v; } },
  { key: "be_target", kind: "number", get: (s) => s.be.target, set: (s, v) => { s.be.target = v; } },
  { key: "dd_value", kind: "number", get: (s) => s.dd.value, set: (s, v) => { s.dd.value = v; } },
  { key: "dd_pcts", kind: "list", max: DD_LIST_MAX, get: (s) => s.dd.pcts, set: (s, v) => { s.dd.pcts = v; } },
];

export function parseQuery(search: string): { state: AppState; hadInvalid: boolean } {
  const q = search.startsWith("?") ? search.slice(1) : search;
  if (q.length > MAX_URL_LENGTH) return { state: cloneState(DEFAULT_STATE), hadInvalid: true };

  const params = new URLSearchParams(q);
  const state = cloneState(DEFAULT_STATE);
  let hadInvalid = false;

  for (const spec of SPECS) {
    const raw = params.get(spec.key); // first value wins
    if (raw === null) continue;

    if (spec.kind === "enum") {
      if (spec.allowed.includes(raw)) spec.set(state, raw);
      else hadInvalid = true;
    } else if (spec.kind === "number") {
      if (raw === "") {
        spec.set(state, "");
        continue;
      }
      const p = parseDecimal(raw);
      if (p.kind === "ok") spec.set(state, p.normalized);
      else hadInvalid = true;
    } else {
      if (raw === "") {
        spec.set(state, []);
        continue;
      }
      let items = raw.split(",");
      if (items.length > spec.max) {
        items = items.slice(0, spec.max);
        hadInvalid = true;
      }
      const out: string[] = [];
      let allOk = true;
      for (const item of items) {
        const p = parseDecimal(item);
        if (p.kind === "ok") out.push(p.normalized);
        else {
          allOk = false;
          break;
        }
      }
      if (allOk) spec.set(state, out);
      else hadInvalid = true;
    }
  }
  return { state, hadInvalid };
}

export function serializeState(state: AppState): string {
  const params = new URLSearchParams();
  for (const spec of SPECS) {
    if (spec.kind === "enum") {
      const v = spec.get(state);
      if (v !== spec.get(DEFAULT_STATE)) params.append(spec.key, v);
    } else if (spec.kind === "number") {
      const v = spec.get(state);
      if (v === spec.get(DEFAULT_STATE)) continue;
      if (v.trim() === "") {
        params.append(spec.key, "");
        continue;
      }
      const p = parseDecimal(v);
      if (p.kind === "ok") params.append(spec.key, p.normalized);
    } else {
      const items: string[] = [];
      for (const raw of spec.get(state)) {
        const p = parseDecimal(raw);
        if (p.kind === "ok") items.push(p.normalized);
      }
      const def = spec.get(DEFAULT_STATE);
      if (items.length === def.length && items.every((x, i) => x === def[i])) continue;
      params.append(spec.key, items.join(","));
    }
  }
  const s = params.toString();
  return s === "" ? "" : "?" + s;
}
