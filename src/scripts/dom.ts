export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export interface Debounced {
  (): void;
  flush(): void;
  cancel(): void;
}

export function debounce(fn: () => void, ms: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn();
    }, ms);
  }) as Debounced;
  run.flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      fn();
    }
  };
  run.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return run;
}

export function setText(el: Element, text: string): void {
  el.textContent = text;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; attrs?: Record<string, string> } = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** Show exactly one of the `[data-state]` children of `container`. */
export function showState(container: HTMLElement, state: "empty" | "invalid" | "ok"): void {
  for (const child of Array.from(container.children)) {
    (child as HTMLElement).hidden = (child as HTMLElement).dataset.state !== state;
  }
}

/** Set (message) or clear (null) the error state of the field with this input id. */
export function setFieldError(id: string, message: string | null): void {
  const input = document.getElementById(id);
  const err = document.getElementById(`${id}-error`);
  const field = input?.closest(".field");
  if (!input || !err || !field) return;
  if (message === null) {
    input.removeAttribute("aria-invalid");
    field.classList.remove("has-error");
    err.hidden = true;
    err.replaceChildren();
  } else {
    input.setAttribute("aria-invalid", "true");
    field.classList.add("has-error");
    err.replaceChildren(el("span", { class: "sr-only", text: "Error: " }), document.createTextNode(message));
    err.hidden = false;
  }
}

/** Build a list row (`<li>`) that follows the Field markup, with a badge and a remove button. */
export function buildRow(opts: {
  id: string;
  index: number;
  srLabel: string;
  removeLabel: string;
  currency: boolean;
  symbol: string;
  suffix?: string;
  value: string;
}): HTMLLIElement {
  const li = el("li", { class: "row-item" });
  const field = el("div", { class: "field", attrs: { "data-field": opts.id } });
  const label = el("label", { class: "sr-only", text: opts.srLabel, attrs: { for: opts.id } });
  const wrapClass = ["input-wrap", opts.currency ? "has-prefix" : "", opts.suffix ? "has-suffix" : ""].filter(Boolean).join(" ");
  const wrap = el("div", { class: wrapClass });
  if (opts.currency) {
    wrap.append(el("span", { class: "adorn adorn-prefix", text: opts.symbol, attrs: { "data-currency-symbol": "", "aria-hidden": "true" } }));
  }
  const input = el("input", {
    attrs: {
      id: opts.id, type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false",
      enterkeyhint: "next", "aria-describedby": `${opts.id}-error`, "data-index": String(opts.index),
    },
  });
  input.value = opts.value;
  wrap.append(input);
  if (opts.suffix) wrap.append(el("span", { class: "adorn adorn-suffix", text: opts.suffix, attrs: { "aria-hidden": "true" } }));
  const line = el("div", { class: "row-line" }, [
    el("span", { class: "badge", text: `#${opts.index + 1}`, attrs: { "aria-hidden": "true" } }),
    wrap,
    el("button", { class: "btn btn-icon", text: "×", attrs: { type: "button", "aria-label": opts.removeLabel, "data-remove": String(opts.index) } }),
  ]);
  field.append(label, line, el("p", { class: "error", attrs: { id: `${opts.id}-error`, hidden: "" } }));
  li.append(field);
  return li;
}

export function debouncedLive(el_: HTMLElement): (text: string) => void {
  let last = "";
  const emit = debounce(() => {
    el_.textContent = last;
  }, 800);
  return (text: string) => {
    last = text;
    emit();
  };
}

export function toneClass(x: number): "pos" | "neg" | "zero" {
  return x > 0 ? "pos" : x < 0 ? "neg" : "zero";
}
export function toneWord(x: number): string {
  return x > 0 ? "gain" : x < 0 ? "loss" : "no change";
}
