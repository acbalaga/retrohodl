import { calcBreakEven } from "../lib/calc/breakeven";
import { formatMoney, formatSignedPct } from "../lib/format";
import { parseDecimal, toCalcInput } from "../lib/parse";
import { DEFAULT_STATE, cloneState } from "../lib/url-state";
import { $, applyFieldErrors, bindField, debounce, debouncedLive, setFieldError, showState } from "./dom";
import type { Store } from "./store";

const num = (s: string) => toCalcInput(parseDecimal(s));
const IDS = { entry: "be-entry", buyFee: "be-buy-fee", sellFee: "be-sell-fee", target: "be-target" } as const;
type Key = keyof typeof IDS;

export function initBreakEven(store: Store): { render(): void } {
  const s = () => store.state.be;
  const touched = new Set<string>();
  const results = $("be-results");
  const out = (name: string) => results.querySelector<HTMLElement>(`[data-out="${name}"]`)!;
  const live = debouncedLive($("be-live"));

  function computeNow(): void {
    const d = s();
    const c = store.state.currency;
    const outcome = calcBreakEven({
      entryPrice: num(d.entry), buyFeePct: num(d.buyFee), sellFeePct: num(d.sellFee), targetGainPct: num(d.target),
    });
    const errors = new Map<string, string>();
    if (outcome.status === "invalid") {
      for (const e of outcome.errors) {
        const id = IDS[e.field];
        if (e.code === "required" && !touched.has(id)) continue;
        errors.set(id, e.message);
      }
    } else if (outcome.status === "empty") {
      for (const f of outcome.missing) if (touched.has(IDS[f])) errors.set(IDS[f], "Enter a value.");
    }
    applyFieldErrors(Object.values(IDS), errors);

    if (outcome.status === "empty") return showState(results, "empty");
    if (outcome.status === "invalid") {
      const n = Math.max(errors.size, 1);
      out("invalid-text").textContent = `${n === 1 ? "1 input needs" : `${n} inputs need`} fixing. Check the highlighted fields.`;
      return showState(results, "invalid");
    }
    const v = outcome.value;
    out("price").textContent = formatMoney(v.breakEvenPrice, c);
    out("move").textContent = formatSignedPct(v.breakEvenMovePct);
    out("cost").textContent = formatMoney(v.costPerUnitInclBuyFee, c);
    const hasTarget = v.targetPrice !== null && v.targetMovePct !== null && v.targetGainPct !== null;
    out("target-block").hidden = !hasTarget;
    out("target-missing").hidden = hasTarget;
    if (hasTarget) {
      out("target-label").textContent = `Sell price for ${formatSignedPct(v.targetGainPct!)} gain`;
      out("target-price").textContent = formatMoney(v.targetPrice!, c);
      out("target-move").textContent = formatSignedPct(v.targetMovePct!);
    }
    showState(results, "ok");
    live(`Break-even sell price: ${formatMoney(v.breakEvenPrice, c)}.`);
  }

  const schedule = debounce(computeNow, 150);
  const base = { touched, schedule, now: computeNow, changed: () => store.changed() };
  (Object.keys(IDS) as Key[]).forEach((k) => {
    bindField($<HTMLInputElement>(IDS[k]), { ...base, set: (v) => { s()[k] = v; } });
  });

  function syncInputs(): void {
    for (const k of Object.keys(IDS) as Key[]) $<HTMLInputElement>(IDS[k]).value = s()[k];
  }

  $("be-form").addEventListener("submit", (e) => e.preventDefault());
  $("be-reset").addEventListener("click", () => {
    Object.assign(store.state.be, cloneState(DEFAULT_STATE).be);
    touched.clear();
    for (const id of Object.values(IDS)) setFieldError(id, null);
    syncInputs();
    store.changed();
    computeNow();
  });

  syncInputs();
  return { render: computeNow };
}
