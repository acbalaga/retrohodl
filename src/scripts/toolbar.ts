import { CURRENCY_SYMBOL, type Currency } from "../lib/format";
import { $, debounce } from "./dom";
import type { Store } from "./store";

export function initCrtToggle(): void {
  const btn = document.getElementById("crt-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const off = document.documentElement.classList.toggle("fx-off");
    btn.setAttribute("aria-pressed", off ? "false" : "true");
  });
}

/** Update every currency adornment in the page (including dynamically built rows). */
export function applyCurrencySymbols(c: Currency): void {
  for (const node of document.querySelectorAll("[data-currency-symbol]")) {
    node.textContent = CURRENCY_SYMBOL[c];
  }
}

export function initToolbar(store: Store, opts: { hadInvalid: boolean; onCurrencyChange: () => void }): void {
  const select = $<HTMLSelectElement>("currency");
  select.value = store.state.currency;
  applyCurrencySymbols(store.state.currency);
  select.addEventListener("change", () => {
    const v = select.value;
    if (v !== "USD" && v !== "PHP" && v !== "EUR") return;
    store.state.currency = v;
    applyCurrencySymbols(v);
    store.changed();
    opts.onCurrencyChange();
  });

  const status = $("share-status");
  const clearStatus = debounce(() => {
    status.textContent = "";
  }, 4000);
  $("share-copy").addEventListener("click", () => {
    store.flushUrl();
    const fail = () => {
      status.textContent = "Could not copy. Copy the address from your browser bar instead.";
      clearStatus();
    };
    if (!navigator.clipboard) {
      fail();
      return;
    }
    navigator.clipboard.writeText(location.href).then(
      () => {
        status.textContent = "Link copied.";
        clearStatus();
      },
      fail,
    );
  });

  const notice = $("url-notice");
  notice.hidden = !opts.hadInvalid;
  $("url-notice-dismiss").addEventListener("click", () => {
    notice.hidden = true;
  });
}
