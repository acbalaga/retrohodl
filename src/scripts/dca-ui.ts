import { buildGrowthPrices, calcDca, type DcaInput } from "../lib/calc/dca";
import { MAX_DCA_ROWS } from "../lib/calc/limits";
import {
  CURRENCY_SYMBOL, formatMoney, formatSignedMoney, formatSignedPct, formatUnits,
} from "../lib/format";
import { parseDecimal, toCalcInput } from "../lib/parse";
import { DEFAULT_STATE, cloneState } from "../lib/url-state";
import {
  $, applyFieldErrors, bindField, buildRow, debounce, debouncedLive, el, setFieldError, showState, toneClass, toneWord,
} from "./dom";
import type { Store } from "./store";

const num = (s: string) => toCalcInput(parseDecimal(s));
const isBlank = (s: string) => s.trim() === "";

type Key = "amount" | "fee" | "start" | "change" | "periods" | "final";
const FIELD_ID: Record<Key, string> = {
  amount: "dca-amount", fee: "dca-fee", start: "dca-start", change: "dca-change", periods: "dca-periods", final: "dca-final",
};
const ERR_FIELD_ID: Record<string, string> = {
  amount: "dca-amount", fee: "dca-fee", final: "dca-final", start: "dca-start", change: "dca-change", periods: "dca-periods",
};

export function initDca(store: Store): { render(): void } {
  const s = () => store.state.dca;
  const touched = new Set<string>();
  const results = $("dca-results");
  const out = (name: string) => results.querySelector<HTMLElement>(`[data-out="${name}"]`)!;
  const live = debouncedLive($("dca-live"));
  const rowsEl = $<HTMLOListElement>("dca-rows");
  const addBtn = $<HTMLButtonElement>("dca-add-row");
  const periodsInput = $<HTMLInputElement>("dca-periods");

  const currency = () => store.state.currency;

  function nonBlankCount(): number {
    return s().prices.filter((p) => !isBlank(p)).length;
  }

  function buildInput(): DcaInput {
    const d = s();
    return {
      amount: num(d.amount),
      feePct: num(d.fee),
      finalPrice: num(d.final),
      source:
        d.mode === "growth"
          ? { mode: "growth", start: num(d.start), changePct: num(d.change), periods: num(d.periods) }
          : { mode: "list", prices: d.prices.map(num) },
    };
  }

  function allErrorIds(): string[] {
    const ids = Object.values(FIELD_ID);
    for (let i = 0; i < s().prices.length; i++) ids.push(`dca-price-${i}`);
    return ids;
  }

  function computeNow(): void {
    const d = s();
    const c = currency();
    const outcome = calcDca(buildInput());
    const errors = new Map<string, string>();
    let listError: string | null = null;
    let shown = 0;

    const addError = (e: { field: string; code: string; message: string; row?: number }) => {
      if (e.field === "prices" && e.row === undefined) {
        // Only when no rows exist: showing it while blank rows exist makes the layout jump under the cursor.
        if (e.code === "required" && (!touched.has("dca-prices") || d.prices.length > 0)) return;
        listError = e.message;
        shown++;
        return;
      }
      const id = e.row !== undefined ? `dca-price-${e.row}` : ERR_FIELD_ID[e.field];
      if (!id) return;
      if (e.code === "required" && !touched.has(id)) return;
      errors.set(id, e.message);
      shown++;
    };

    if (outcome.status === "invalid") outcome.errors.forEach(addError);
    if (outcome.status === "empty") {
      for (const f of outcome.missing) {
        addError({ field: f, code: "required", message: f === "prices" ? "Add at least one price." : "Enter a value." });
      }
    }
    // list mode hides growth-only fields; never show errors for hidden fields
    if (d.mode === "list") for (const k of ["dca-start", "dca-change"]) errors.delete(k);
    if (d.mode === "list") errors.delete("dca-periods");

    applyFieldErrors(allErrorIds(), errors);
    const listErr = $("dca-prices-error");
    if (listError) {
      listErr.replaceChildren(el("span", { class: "sr-only", text: "Error: " }), document.createTextNode(listError));
      listErr.hidden = false;
    } else {
      listErr.hidden = true;
      listErr.replaceChildren();
    }

    if (outcome.status === "empty") {
      out("empty-text").textContent =
        d.mode === "list" && outcome.missing.includes("prices") ? "Add at least one price to see results." : "Fill in the fields to see results.";
      showState(results, "empty");
      return;
    }
    if (outcome.status === "invalid") {
      const n = Math.max(shown, 1);
      out("invalid-text").textContent = `${n === 1 ? "1 input needs" : `${n} inputs need`} fixing. Check the highlighted fields.`;
      showState(results, "invalid");
      return;
    }

    const v = outcome.value;
    const tone = toneClass(v.pnl);
    const pnl = out("pnl");
    pnl.textContent = formatSignedMoney(v.pnl, c);
    pnl.className = `headline-value ${tone}`;
    const sub = out("pnlPct").parentElement!;
    sub.className = `headline-sub ${tone}`;
    out("pnlPct").textContent = formatSignedPct(v.pnlPct);
    out("pnlWord").textContent = toneWord(v.pnl);
    out("totalInvested").textContent = formatMoney(v.totalInvested, c);
    out("totalFees").textContent = formatMoney(v.totalFees, c);
    out("unitsAcquired").textContent = formatUnits(v.unitsAcquired);
    out("avgCostInclFees").textContent = formatMoney(v.avgCostInclFees, c);
    out("avgPriceExclFees").textContent = formatMoney(v.avgPriceExclFees, c);
    out("currentValue").textContent = formatMoney(v.currentValue, c);
    out("periods").textContent = String(v.periods);
    const notes = out("notes");
    notes.textContent = outcome.notes.map((n) => n.message).join(" ");
    notes.hidden = outcome.notes.length === 0;
    out("tableSummary").textContent = `Per-period table (${v.periods} rows)`;
    const tbody = out("tbody");
    const frag = document.createDocumentFragment();
    for (const r of v.rows) {
      frag.append(
        el("tr", {}, [
          el("td", { text: String(r.period) }),
          el("td", { text: formatMoney(r.price, c) }),
          el("td", { text: formatMoney(r.spent, c) }),
          el("td", { text: formatMoney(r.fee, c) }),
          el("td", { text: formatUnits(r.units) }),
          el("td", { text: formatUnits(r.cumUnits) }),
          el("td", { text: formatMoney(r.avgCost, c) }),
        ]),
      );
    }
    tbody.replaceChildren(frag);
    showState(results, "ok");
    live(`Profit or loss at final price: ${formatSignedMoney(v.pnl, c)} (${formatSignedPct(v.pnlPct)}).`);
  }

  const schedule = debounce(computeNow, 150);

  // ----- list rows -----
  function renderRows(): void {
    const frag = document.createDocumentFragment();
    s().prices.forEach((p, i) => {
      frag.append(
        buildRow({
          id: `dca-price-${i}`, index: i, srLabel: `Period ${i + 1} price`, removeLabel: `Remove period ${i + 1} price`,
          currency: true, symbol: CURRENCY_SYMBOL[currency()], value: p,
        }),
      );
    });
    rowsEl.replaceChildren(frag);
    updateRowControls();
  }

  function updateRowControls(): void {
    addBtn.disabled = s().prices.length >= MAX_DCA_ROWS;
    if (s().mode === "list") periodsInput.value = String(nonBlankCount());
  }

  function prefillPrices(): void {
    const d = s();
    const probe = calcDca({
      amount: 1, feePct: 0, finalPrice: 1,
      source: { mode: "growth", start: num(d.start), changePct: num(d.change), periods: num(d.periods) },
    });
    if (probe.status === "ok") {
      d.prices = buildGrowthPrices(num(d.start)!, num(d.change)!, num(d.periods)!)
        .slice(0, MAX_DCA_ROWS)
        .map((p) => String(Number(p.toPrecision(8))));
    } else {
      d.prices = ["", "", ""];
    }
  }

  function applyMode(): void {
    const list = s().mode === "list";
    $("dca-growth-fields").hidden = list;
    $("dca-list-fields").hidden = !list;
    periodsInput.disabled = list;
    $("dca-periods-hint").textContent = list ? "Set by the number of prices below." : "1 to 600.";
    periodsInput.value = list ? String(nonBlankCount()) : s().periods;
    ($("dca-mode-growth") as HTMLInputElement).checked = !list;
    ($("dca-mode-list") as HTMLInputElement).checked = list;
  }

  function syncInputs(): void {
    const d = s();
    $<HTMLInputElement>(FIELD_ID.amount).value = d.amount;
    $<HTMLInputElement>(FIELD_ID.fee).value = d.fee;
    $<HTMLInputElement>(FIELD_ID.start).value = d.start;
    $<HTMLInputElement>(FIELD_ID.change).value = d.change;
    $<HTMLInputElement>(FIELD_ID.final).value = d.final;
    if (d.mode === "list") renderRows();
    else rowsEl.replaceChildren();
    applyMode();
    updateRowControls();
  }

  // ----- wiring -----
  const base = { touched, schedule, now: computeNow, changed: () => store.changed() };
  (["amount", "fee", "start", "change", "final"] as const).forEach((k) => {
    bindField($<HTMLInputElement>(FIELD_ID[k]), { ...base, set: (v) => { s()[k] = v; } });
  });
  // Periods is only editable in growth mode (disabled in list mode).
  bindField(periodsInput, { ...base, set: (v) => { if (s().mode === "growth") s().periods = v; } });

  for (const mode of ["growth", "list"] as const) {
    $(`dca-mode-${mode}`).addEventListener("change", () => {
      s().mode = mode;
      if (mode === "list" && s().prices.length === 0) prefillPrices();
      syncInputs();
      store.changed();
      computeNow();
    });
  }

  rowsEl.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const i = Number(t.dataset.index);
    if (!Number.isInteger(i) || i < 0 || i >= s().prices.length) return;
    s().prices[i] = t.value;
    if (!isBlank(t.value)) touched.add("dca-prices");
    periodsInput.value = String(nonBlankCount());
    store.changed();
    schedule();
  });
  rowsEl.addEventListener("focusout", () => {
    touched.add("dca-prices");
    computeNow();
  });
  rowsEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-remove]");
    if (!btn) return;
    const i = Number(btn.dataset.remove);
    s().prices.splice(i, 1);
    touched.add("dca-prices");
    renderRows();
    const target =
      document.getElementById(`dca-price-${i}`) ?? document.getElementById(`dca-price-${i - 1}`) ?? addBtn;
    target.focus();
    store.changed();
    computeNow();
  });
  addBtn.addEventListener("click", () => {
    if (s().prices.length >= MAX_DCA_ROWS) return;
    s().prices.push("");
    touched.add("dca-prices");
    renderRows();
    document.getElementById(`dca-price-${s().prices.length - 1}`)?.focus();
    store.changed();
    computeNow();
  });

  $("dca-form").addEventListener("submit", (e) => e.preventDefault());
  $("dca-reset").addEventListener("click", () => {
    Object.assign(store.state.dca, cloneState(DEFAULT_STATE).dca);
    touched.clear();
    for (const id of allErrorIds()) setFieldError(id, null);
    syncInputs();
    store.changed();
    computeNow();
  });

  syncInputs();
  return { render: computeNow };
}
