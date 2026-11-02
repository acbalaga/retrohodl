import { calcDrawdown } from "../lib/calc/drawdown";
import { MAX_DD_ROWS } from "../lib/calc/limits";
import { CURRENCY_SYMBOL, formatMoney, formatPct } from "../lib/format";
import { parseDecimal, toCalcInput } from "../lib/parse";
import { DEFAULT_STATE, cloneState } from "../lib/url-state";
import {
  $, applyFieldErrors, bindField, buildRow, debounce, debouncedLive, el, setFieldError, showState,
} from "./dom";
import type { Store } from "./store";

const num = (s: string) => toCalcInput(parseDecimal(s));

export function initDrawdown(store: Store): { render(): void } {
  const s = () => store.state.dd;
  const touched = new Set<string>();
  const results = $("dd-results");
  const out = (name: string) => results.querySelector<HTMLElement>(`[data-out="${name}"]`)!;
  const live = debouncedLive($("dd-live"));
  const rowsEl = $<HTMLOListElement>("dd-rows");
  const addBtn = $<HTMLButtonElement>("dd-add-row");

  function allErrorIds(): string[] {
    const ids = ["dd-value"];
    for (let i = 0; i < s().pcts.length; i++) ids.push(`dd-pct-${i}`);
    return ids;
  }

  function computeNow(): void {
    const d = s();
    const c = store.state.currency;
    const outcome = calcDrawdown({ positionValue: num(d.value), drawdownsPct: d.pcts.map(num) });
    const errors = new Map<string, string>();
    let listError: string | null = null;
    let shown = 0;

    const addError = (e: { field: string; code: string; message: string; row?: number }) => {
      if (e.field === "drawdowns" && e.row === undefined) {
        // Only when no rows exist: showing it while blank rows exist makes the layout jump under the cursor.
        if (e.code === "required" && (!touched.has("dd-pcts") || d.pcts.length > 0)) return;
        listError = e.message;
        shown++;
        return;
      }
      const id = e.row !== undefined ? `dd-pct-${e.row}` : "dd-value";
      if (e.code === "required" && !touched.has(id)) return;
      errors.set(id, e.message);
      shown++;
    };
    if (outcome.status === "invalid") outcome.errors.forEach(addError);
    if (outcome.status === "empty") {
      for (const f of outcome.missing) {
        addError({ field: f, code: "required", message: f === "drawdowns" ? "Add at least one drawdown %." : "Enter a value." });
      }
    }
    applyFieldErrors(allErrorIds(), errors);
    const listErr = $("dd-pcts-error");
    if (listError) {
      listErr.replaceChildren(el("span", { class: "sr-only", text: "Error: " }), document.createTextNode(listError));
      listErr.hidden = false;
    } else {
      listErr.hidden = true;
      listErr.replaceChildren();
    }

    if (outcome.status === "empty") {
      out("empty-text").textContent =
        outcome.missing.includes("drawdowns") ? "Add at least one drawdown % to see results." : "Fill in the fields to see results.";
      return showState(results, "empty");
    }
    if (outcome.status === "invalid") {
      const n = Math.max(shown, 1);
      out("invalid-text").textContent = `${n === 1 ? "1 input needs" : `${n} inputs need`} fixing. Check the highlighted fields.`;
      return showState(results, "invalid");
    }

    const frag = document.createDocumentFragment();
    for (const r of outcome.value.rows) {
      const bar = el("span", { class: "bar", attrs: { "aria-hidden": "true" } });
      bar.style.width = `${100 - r.drawdownPct}%`;
      frag.append(
        el("tr", {}, [
          el("td", { text: formatPct(r.drawdownPct) }),
          el("td", {}, [formatMoney(r.valueAfter, c), bar]),
          el("td", { text: formatMoney(r.loss, c) }),
          r.recoveryGainPct === null
            ? el("td", { class: "na", text: "Not recoverable (value is 0)" })
            : el("td", { text: formatPct(r.recoveryGainPct) }),
        ]),
      );
    }
    out("tbody").replaceChildren(frag);
    const notes = out("notes");
    notes.textContent = outcome.notes.map((n) => n.message).join(" ");
    notes.hidden = outcome.notes.length === 0;
    showState(results, "ok");
    live(`${outcome.value.rows.length} drawdown rows calculated.`);
  }

  const schedule = debounce(computeNow, 150);

  function renderRows(): void {
    const frag = document.createDocumentFragment();
    s().pcts.forEach((p, i) => {
      frag.append(
        buildRow({
          id: `dd-pct-${i}`, index: i, srLabel: `Drawdown ${i + 1}`, removeLabel: `Remove drawdown ${i + 1}`,
          currency: false, symbol: CURRENCY_SYMBOL[store.state.currency], suffix: "%", value: p,
        }),
      );
    });
    rowsEl.replaceChildren(frag);
    addBtn.disabled = s().pcts.length >= MAX_DD_ROWS;
  }

  const base = { touched, schedule, now: computeNow, changed: () => store.changed() };
  bindField($<HTMLInputElement>("dd-value"), { ...base, set: (v) => { s().value = v; } });

  rowsEl.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const i = Number(t.dataset.index);
    if (!Number.isInteger(i) || i < 0 || i >= s().pcts.length) return;
    s().pcts[i] = t.value;
    if (t.value.trim() !== "") touched.add("dd-pcts");
    store.changed();
    schedule();
  });
  rowsEl.addEventListener("focusout", () => {
    touched.add("dd-pcts");
    computeNow();
  });
  rowsEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-remove]");
    if (!btn) return;
    const i = Number(btn.dataset.remove);
    s().pcts.splice(i, 1);
    touched.add("dd-pcts");
    renderRows();
    (document.getElementById(`dd-pct-${i}`) ?? document.getElementById(`dd-pct-${i - 1}`) ?? addBtn).focus();
    store.changed();
    computeNow();
  });
  addBtn.addEventListener("click", () => {
    if (s().pcts.length >= MAX_DD_ROWS) return;
    s().pcts.push("");
    touched.add("dd-pcts");
    renderRows();
    document.getElementById(`dd-pct-${s().pcts.length - 1}`)?.focus();
    store.changed();
    computeNow();
  });

  function syncInputs(): void {
    $<HTMLInputElement>("dd-value").value = s().value;
    renderRows();
  }

  $("dd-form").addEventListener("submit", (e) => e.preventDefault());
  $("dd-reset").addEventListener("click", () => {
    Object.assign(store.state.dd, cloneState(DEFAULT_STATE).dd);
    touched.clear();
    for (const id of allErrorIds()) setFieldError(id, null);
    syncInputs();
    store.changed();
    computeNow();
  });

  syncInputs();
  return { render: computeNow };
}
