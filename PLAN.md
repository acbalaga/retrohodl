# retrohodl.xyz: v1 Technical Plan

This is the build spec for retrohodl.xyz. The executor implements it exactly as written. Where a decision exists, it is made here. If something is ambiguous, pick the reading that changes the least and leave a `TODO(plan):` comment. Do not invent features.

## 0. Decisions made in this plan (one line each)

- **Fee model:** fees are taken out of the amount spent (fee-inclusive). If you spend 100 with a 1% fee, 99 buys units. This applies to DCA and to Break-even.
- **DCA "current value"** is the value at the final price **before** any sell fee. Sell fees belong to the Break-even tab, and the hint text says so.
- **DCA list mode:** the number of periods comes from the count of non-blank price rows. The Periods field is disabled in list mode.
- **DCA growth mode:** `price_i = start × (1 + change)^(i−1)`, so period 1 is the start price.
- **Break-even "entry"** is the price per unit **before** fees. Target gain % is measured against total cash spent (fees included).
- **Drawdown rows are independent.** Each row applies to the starting position value. They do not compound.
- **Drawdown of exactly 100%** is allowed: value 0, recovery shown as "Not recoverable". Over 100% is an error.
- **Numbers** use plain JS `number` (float64). Rounding happens only at display. No decimal library.
- **Number input:** `.` is the decimal separator. Spaces, commas, underscores and apostrophes are stripped as grouping characters. No locale-aware parsing.
- **Currency** is a symbol only (`$`, `₱`, `€`), always a prefix, always en-US digit grouping. No FX.
- **Inputs are `type="text" inputmode="decimal"`**, not `type="number"`.
- **Calculation is live** (debounced on input). There is no submit button.
- **All three tabs' state lives in the URL at once,** so switching tabs never loses input. Fields equal to their default are omitted.
- **Fonts:** VT323 (display) and JetBrains Mono (numbers, inputs), both SIL OFL 1.1, self-hosted through Fontsource npm packages bundled at build. Body copy uses the system sans stack (nothing downloaded).
- **No flicker animation, ever.** Scanlines are static. The only motion is a blinking cursor and a slow, faint "roll" band, both removed under `prefers-reduced-motion`.
- **CRT effects toggle** in the header (not persisted anywhere).
- **Tests and checks run inside `npm run build`,** so Cloudflare never deploys a build with failing tests.
- **CSP blocks all network connections** (`connect-src 'none'`), which enforces "no API calls" at the browser level.
- **Astro 5.x**, static output, no integrations. Sitemap and robots are hand-written files.
- **Node 22.12.0** everywhere (local `.nvmrc`, `engines`, Cloudflare env var).

---

## 1. Repo file tree

```
retrohodl/
├── .gitignore
├── .nvmrc                          # 22.12.0
├── PLAN.md
├── README.md
├── astro.config.mjs
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── assets-src/
│   ├── og.svg                      # source for public/og.png
│   └── favicon.svg                 # same file as public/favicon.svg (source copy)
├── scripts/
│   ├── make-images.mjs             # one-off: renders og.png, apple-touch-icon.png, favicon-32.png with sharp
│   └── check-copy.mjs              # banned-words check on user-facing copy (runs in build)
├── public/
│   ├── _headers                    # Cloudflare Pages headers (CSP, caching, noindex on pages.dev)
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── favicon.svg
│   ├── favicon-32.png
│   ├── apple-touch-icon.png
│   ├── og.png                      # 1200x630
│   └── licenses/
│       └── fonts.txt               # OFL 1.1 text + copyright lines for VT323 and JetBrains Mono
├── src/
│   ├── env.d.ts
│   ├── lib/                        # PURE. No DOM, no window, no document. Importable by Vitest in node.
│   │   ├── calc/
│   │   │   ├── types.ts            # shared types (Outcome, FieldError, Note, codes)
│   │   │   ├── messages.ts         # every user-facing validation string, one place
│   │   │   ├── limits.ts           # numeric limits (MAX_MONEY, MAX_PERIODS, ...)
│   │   │   ├── dca.ts
│   │   │   ├── breakeven.ts
│   │   │   ├── drawdown.ts
│   │   │   └── index.ts            # re-exports
│   │   ├── parse.ts                # parseDecimal
│   │   ├── format.ts               # money / units / pct formatting
│   │   └── url-state.ts            # AppState, defaults, parseQuery, serializeState
│   ├── scripts/                    # browser-only code
│   │   ├── main.ts                 # entry: boot, wire everything
│   │   ├── store.ts                # tiny state store
│   │   ├── dom.ts                  # helpers: $, debounce, setText, showState, setFieldError
│   │   ├── tabs.ts                 # ARIA tabs
│   │   ├── toolbar.ts              # currency select, copy link, CRT toggle, URL notice
│   │   ├── dca-ui.ts
│   │   ├── breakeven-ui.ts
│   │   └── drawdown-ui.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── fonts.css               # Fontsource imports + family tokens
│   │   ├── base.css                # reset, typography, focus, layout
│   │   ├── crt.css                 # scanlines, glow, roll band, cursor, fallbacks
│   │   └── components.css          # cards, fields, tabs, tables, stats, buttons
│   ├── layouts/
│   │   └── Base.astro              # <head>, meta, header, footer slot
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── Disclaimer.astro        # the one-line disclaimer, reused
│   │   ├── Toolbar.astro           # currency select + copy link + URL notice
│   │   ├── Tabs.astro              # tablist + three panels (slots)
│   │   ├── Field.astro             # label + input + adornment + hint + error
│   │   ├── DcaPanel.astro
│   │   ├── BreakEvenPanel.astro
│   │   ├── DrawdownPanel.astro
│   │   └── HowCalculated.astro     # <details> with formula text
│   └── pages/
│       ├── index.astro
│       └── 404.astro
└── tests/
    ├── parse.test.ts
    ├── format.test.ts
    ├── dca.test.ts
    ├── breakeven.test.ts
    ├── drawdown.test.ts
    └── url-state.test.ts
```

Rules:
- `src/lib/**` must not reference `window`, `document`, `location`, `navigator`, or `localStorage`. Acceptance check: `grep -rnE "window|document|location|navigator|localStorage" src/lib` returns nothing.
- No file in `src/` uses `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `eval`. Build DOM with `createElement` and `textContent`.
- No `localStorage`, `sessionStorage`, `indexedDB`, or cookies anywhere.

---

## 2. Formulas, edge cases, validation

### 2.1 Shared limits (`src/lib/calc/limits.ts`)

| Constant | Value | Applies to |
|---|---|---|
| `MAX_MONEY` | `1e12` | amount per period, start price, final price, list prices, entry price, position value |
| `MAX_PERIODS` | `600` | DCA growth mode periods |
| `MAX_DCA_ROWS` | `120` | DCA list mode rows |
| `MAX_DD_ROWS` | `20` | Drawdown rows |
| `MIN_PATH_PRICE` | `1e-12` | smallest allowed generated growth price |
| `MAX_PATH_PRICE` | `1e15` | largest allowed generated growth price |
| `MAX_CHANGE_PCT` | `1000` | DCA per-period change upper bound |
| `MAX_TARGET_PCT` | `10000` | Break-even target gain upper bound |
| `ZERO_EPS_REL` | `1e-9` | P/L snap-to-zero tolerance (relative to total invested) |

### 2.2 Input pipeline

`UI string → parseDecimal() → number | null | NaN → calc function → Outcome`

- `parseDecimal` returns `empty`, `invalid`, or `ok`. The UI maps `empty → null`, `invalid → NaN`, `ok → value`.
- Calc functions do all range validation. They receive `null` for blank and `NaN` for unparseable, so tests cover every message.

#### `parseDecimal(raw: string)` algorithm (exact)

1. `s = raw.trim()`. If `s === ""` return `{ kind: "empty" }`.
2. Replace U+2212 (`−`) with `-`.
3. Remove every character matching `/[\s,_']/g`.
4. If `s.length > 24` return `{ kind: "invalid" }`.
5. If `s` does not match `/^[+-]?(\d+(\.\d*)?|\.\d+)$/` return `{ kind: "invalid" }`.
6. Normalize: drop a leading `+`; if it ends with `.`, drop the `.`; if it starts with `.` prefix `0`; if it starts with `-.` replace with `-0.`.
7. `value = Number(s)`. If `!Number.isFinite(value)` or `Math.abs(value) >= 1e15` return `{ kind: "invalid" }`.
8. If `value === 0` and `s` starts with `-`, set `s = s.slice(1)` and `value = 0` (no negative zero).
9. Return `{ kind: "ok", value, normalized: s }`.

### 2.3 Outcome rules (all calculators)

Each calculator collects **all** errors, then decides:
1. If any error has a code other than `required` → `{ status: "invalid", errors }` (errors include any `required` ones too).
2. Else if any `required` error → `{ status: "empty", missing }` (list of fields).
3. Else → `{ status: "ok", value, notes }`.

Per-field check order (stop at the first failure for that field): `null → required`, `NaN → not_a_number`, then range checks in the order listed per field below.

### 2.4 Validation messages (`src/lib/calc/messages.ts`, exact strings)

| Code | Message |
|---|---|
| `required` (default) | `Enter a value.` |
| `required` on DCA `prices` | `Add at least one price.` |
| `required` on Drawdown `drawdowns` | `Add at least one drawdown %.` |
| `not_a_number` | `Enter a number using digits and a dot for decimals, e.g. 1250.50.` |
| `not_positive` | `Must be greater than 0.` |
| `too_large` | `Must be 1,000,000,000,000 or less.` |
| `fee_out_of_range` | `Fee must be 0% or more and less than 100%.` |
| `periods_out_of_range` | `Enter a whole number from 1 to 600.` |
| `change_out_of_range` | `Change must be greater than -100% and no more than 1,000%.` |
| `price_path_invalid` | `With this start price and change, some prices fall below 0.000000000001 or rise above 1,000,000,000,000,000. Use fewer periods or a smaller change.` |
| `target_out_of_range` | `Target gain must be greater than -100% and no more than 10,000%.` |
| `drawdown_out_of_range` | `Drawdown must be from 0% to 100%.` |
| `too_many_rows` | `Use at most {max} rows.` (replace `{max}`) |

Notes (non-blocking, shown under results in muted text):

| Code | Message |
|---|---|
| `blank_rows_ignored` | count 1: `1 blank row ignored.` count n>1: `{n} blank rows ignored.` |

UI-only strings (live in the `.astro`/UI files, not in `messages.ts`):

| Where | String |
|---|---|
| Results empty state (all tabs) | `Fill in the fields to see results.` |
| Results empty state, DCA list mode with zero prices | `Add at least one price to see results.` |
| Results empty state, Drawdown with zero rows | `Add at least one drawdown % to see results.` |
| Results invalid state | `1 input needs fixing.` / `{n} inputs need fixing.` followed by ` Check the highlighted fields.` |
| URL notice | `Some values in this link could not be read and were reset to defaults.` |
| Copy link success | `Link copied.` |
| Copy link failure | `Could not copy. Copy the address from your browser bar instead.` |
| Drawdown recovery when d = 100 | `Not recoverable (value is 0)` |
| `<noscript>` | `These calculators need JavaScript. Nothing you type is sent anywhere.` |

### 2.5 DCA Plan

Inputs (after parsing):
- `A` amount per period. Required. `> 0`, `≤ MAX_MONEY`.
- `feePct`. Required. `0 ≤ feePct < 100`. `f = feePct / 100`.
- `finalPrice` `Pf`. Required. `> 0`, `≤ MAX_MONEY`.
- Price source, one of:
  - **growth**: `start` S (required, `> 0`, `≤ MAX_MONEY`), `changePct` (required, `> -100`, `≤ 1000`), `periods` n (required, integer, `1..600`; non-integer → `periods_out_of_range`). `g = changePct / 100`.
  - **list**: `prices: (number | null | NaN)[]`. `null` = blank row, ignored. If `prices.length > MAX_DCA_ROWS` → `too_many_rows` on field `prices`. Each non-null entry: `NaN → not_a_number`, `≤ 0 → not_positive`, `> MAX_MONEY → too_large`, error carries `row` = original 0-based index. If zero non-null entries → `required` on `prices`. Blank count `k > 0` → note `blank_rows_ignored`.

Price path:
- growth: `p_i = S × (1 + g)^(i−1)` for `i = 1..n`. Compute with `S * Math.pow(1 + g, i - 1)`. If any `p_i` is not finite, `< MIN_PATH_PRICE`, or `> MAX_PATH_PRICE` → `price_path_invalid` on field `change`. Only run this check when S, change and periods are each individually valid.
- list: `p_i` = the non-null entries in order. `n` = their count.

Outputs (for `i = 1..n`):

| Output | Formula |
|---|---|
| `spent_i` | `A` |
| `fee_i` | `A × f` |
| `units_i` | `A × (1 − f) / p_i` |
| `totalInvested` | `n × A` |
| `totalFees` | `n × A × f` |
| `netInvested` | `totalInvested − totalFees` |
| `unitsAcquired` | `Σ units_i` (sum in period order) |
| `avgCostInclFees` | `totalInvested / unitsAcquired` |
| `avgPriceExclFees` | `netInvested / unitsAcquired` (equals the harmonic mean of prices) |
| `currentValue` | `unitsAcquired × Pf` |
| `pnl` | `currentValue − totalInvested` |
| `pnlPct` | `pnl / totalInvested × 100` |
| row `cumUnits_i` | running sum of `units_i` |
| row `cumInvested_i` | `i × A` |
| row `avgCost_i` | `cumInvested_i / cumUnits_i` |

Snap to zero: if `Math.abs(pnl) < ZERO_EPS_REL × totalInvested`, set `pnl = 0` and `pnlPct = 0`.

Edge cases:
- `fee = 0`: valid. `totalFees = 0`, `avgCostInclFees === avgPriceExclFees`.
- `fee ≥ 100` or `< 0`: `fee_out_of_range`.
- Zero or negative amount/start/final/list price: `not_positive`.
- Division by zero is impossible once validation passes (`A > 0`, `1 − f > 0`, `p_i > 0` ⇒ `unitsAcquired > 0`).
- In list mode, `start`, `change`, `periods` are **not** validated (they may be blank). In growth mode, `prices` is **not** validated.

### 2.6 Break-even

Inputs:
- `entryPrice` P. Required. `> 0`, `≤ MAX_MONEY`.
- `buyFeePct`, `sellFeePct`. Required. `0 ≤ x < 100`. `fb`, `fs` = value / 100.
- `targetGainPct` g%. **Optional** (null is fine, not an error). If present: `> -100`, `≤ MAX_TARGET_PCT`.

Outputs:

| Output | Formula |
|---|---|
| `costPerUnitInclBuyFee` | `P / (1 − fb)` |
| `breakEvenPrice` | `P / ((1 − fb) × (1 − fs))` |
| `breakEvenMovePct` | `(breakEvenPrice / P − 1) × 100` |
| `targetPrice` | `P × (1 + g/100) / ((1 − fb) × (1 − fs))`, or `null` if g is null |
| `targetMovePct` | `(targetPrice / P − 1) × 100`, or `null` |

Why: per unit, cash out is `P/(1−fb)`. Selling at Q nets `Q × (1 − fs)`. Break-even sets them equal. A target gain g sets `Q(1 − fs) = (1 + g) × P/(1 − fb)`.

Edge cases: both fees 0 → `breakEvenPrice = P`, move 0. Negative target (e.g. −10) is valid and gives a price below entry. Fees at 100 → `fee_out_of_range` (prevents divide by zero).

### 2.7 Drawdown

Inputs:
- `positionValue` V. Required. `> 0`, `≤ MAX_MONEY`.
- `drawdownsPct: (number | null | NaN)[]`. `null` = blank row, ignored (note). `> MAX_DD_ROWS` entries → `too_many_rows`. Each non-null: `NaN → not_a_number`, `< 0` or `> 100 → drawdown_out_of_range` (with `row`). Zero non-null → `required` on `drawdowns`.

Outputs per non-blank row (keep user order and keep the original 0-based `sourceIndex`):

| Output | Formula |
|---|---|
| `valueAfter` | `V × (100 − d) / 100` |
| `loss` | `V × d / 100` |
| `recoveryGainPct` | if `d < 100`: `d / (100 − d) × 100` (algebraically equal to `(1/(1−d) − 1) × 100` with d as a fraction). If `d === 100`: `null` |
| `recoverable` | `d < 100` |

Use the `d / (100 − d)` form in code. It is the same formula with less float error.

Edge cases: `d = 0` → value V, loss 0, recovery 0. `d = 100` → value 0, recovery null, row shows `Not recoverable (value is 0)`. Duplicate percentages are allowed.

---

## 3. Calc module API (`src/lib`)

```ts
// src/lib/parse.ts
export type ParsedNumber =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "ok"; value: number; normalized: string };
export function parseDecimal(raw: string): ParsedNumber;
/** empty → null, invalid → NaN, ok → value */
export function toCalcInput(p: ParsedNumber): number | null;

// src/lib/calc/types.ts
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

// src/lib/calc/messages.ts
export function errorMessage(code: ErrorCode, field?: string, params?: { max?: number }): string;
export function noteMessage(code: NoteCode, params: { count: number }): string;

// src/lib/calc/dca.ts
export type DcaField = "amount" | "fee" | "final" | "start" | "change" | "periods" | "prices";
export type DcaPriceSource =
  | { mode: "growth"; start: Num; changePct: Num; periods: Num }
  | { mode: "list"; prices: Num[] };
export interface DcaInput { amount: Num; feePct: Num; finalPrice: Num; source: DcaPriceSource }
export interface DcaRow {
  period: number;        // 1-based
  price: number;
  spent: number;
  fee: number;
  units: number;
  cumUnits: number;
  cumInvested: number;
  avgCost: number;
}
export interface DcaResult {
  periods: number;
  totalInvested: number;
  totalFees: number;
  netInvested: number;
  unitsAcquired: number;
  avgCostInclFees: number;
  avgPriceExclFees: number;
  finalPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  rows: DcaRow[];
}
export function buildGrowthPrices(start: number, changePct: number, periods: number): number[];
export function calcDca(input: DcaInput): Outcome<DcaResult, DcaField>;

// src/lib/calc/breakeven.ts
export type BreakEvenField = "entry" | "buyFee" | "sellFee" | "target";
export interface BreakEvenInput { entryPrice: Num; buyFeePct: Num; sellFeePct: Num; targetGainPct: Num }
export interface BreakEvenResult {
  costPerUnitInclBuyFee: number;
  breakEvenPrice: number;
  breakEvenMovePct: number;
  targetGainPct: number | null;
  targetPrice: number | null;
  targetMovePct: number | null;
}
export function calcBreakEven(input: BreakEvenInput): Outcome<BreakEvenResult, BreakEvenField>;

// src/lib/calc/drawdown.ts
export type DrawdownField = "value" | "drawdowns";
export interface DrawdownInput { positionValue: Num; drawdownsPct: Num[] }
export interface DrawdownRow {
  sourceIndex: number;
  drawdownPct: number;
  valueAfter: number;
  loss: number;
  recoveryGainPct: number | null;
  recoverable: boolean;
}
export interface DrawdownResult { positionValue: number; rows: DrawdownRow[] }
export function calcDrawdown(input: DrawdownInput): Outcome<DrawdownResult, DrawdownField>;

// src/lib/format.ts
export type Currency = "USD" | "PHP" | "EUR";
export const CURRENCY_SYMBOL: Record<Currency, string>; // { USD: "$", PHP: "₱", EUR: "€" }
export function formatMoney(x: number, c: Currency): string;
export function formatSignedMoney(x: number, c: Currency): string;
export function formatUnits(x: number): string;
export function formatPct(x: number): string;
export function formatSignedPct(x: number): string;
```

### Formatting rules (`format.ts`)

All use `Intl.NumberFormat("en-US", …)` with grouping on. Treat `-0` as `0`.

- `formatMoney(x, c)`: let `a = |x|`. Digits:
  - `a === 0` → `"0.00"`
  - `a ≥ 1` → exactly 2 decimals
  - `0.01 ≤ a < 1` → exactly 4 decimals
  - `0 < a < 0.01` → `maximumSignificantDigits: 4`
  - Output: `(x < 0 ? "-" : "") + symbol + digits`.
- `formatSignedMoney`: same, but prefix `+` when `x > 0`. Zero has no sign.
- `formatUnits(x)`: `minimumFractionDigits: 0, maximumFractionDigits: 8`.
- `formatPct(x)`: 2 decimals + `%`, minus sign if negative.
- `formatSignedPct(x)`: as `formatPct`, plus `+` when `x > 0`.

---

## 4. Test cases (Vitest)

Use `toBeCloseTo(expected, 9)` for every float unless noted. Expected values were computed with float64.

### 4.1 `tests/parse.test.ts`

| Input | Expected |
|---|---|
| `""`, `"   "` | `{ kind: "empty" }` |
| `"1250.50"` | ok, value `1250.5`, normalized `"1250.50"` |
| `"1,250.50"` | ok, value `1250.5`, normalized `"1250.50"` |
| `" 1 000 "` | ok, `1000`, `"1000"` |
| `"+5"` | ok, `5`, `"5"` |
| `"5."` | ok, `5`, `"5"` |
| `".5"` | ok, `0.5`, `"0.5"` |
| `"-.5"` | ok, `-0.5`, `"-0.5"` |
| `"−2"` (U+2212) | ok, `-2`, `"-2"` |
| `"-0"` | ok, `0`, `"0"` |
| `"abc"`, `"1.2.3"`, `"1e5"`, `"$100"`, `"10%"`, `"-"`, `"."` | `{ kind: "invalid" }` |
| `"1".repeat(25)` | invalid (length) |
| `"1000000000000000"` (1e15) | invalid (magnitude) |
| `toCalcInput` of empty / invalid / ok(3) | `null` / `NaN` / `3` |

### 4.2 `tests/format.test.ts`

| Call | Expected |
|---|---|
| `formatMoney(1234.5, "USD")` | `"$1,234.50"` |
| `formatMoney(-50, "PHP")` | `"-₱50.00"` |
| `formatMoney(0.5, "EUR")` | `"€0.5000"` |
| `formatMoney(0.00001234, "USD")` | `"$0.00001234"` |
| `formatMoney(0, "USD")` and `formatMoney(-0, "USD")` | `"$0.00"` |
| `formatSignedMoney(230, "USD")` | `"+$230.00"` |
| `formatSignedMoney(-50, "USD")` | `"-$50.00"` |
| `formatSignedMoney(0, "USD")` | `"$0.00"` |
| `formatUnits(21)` | `"21"` |
| `formatUnits(20.790000000000003)` | `"20.79"` |
| `formatUnits(2.7355371900826446)` | `"2.73553719"` |
| `formatUnits(1234567.123456789)` | `"1,234,567.12345679"` |
| `formatPct(57.49999999999999)` | `"57.50%"` |
| `formatPct(9900)` | `"9,900.00%"` |
| `formatSignedPct(10.333333333333334)` | `"+10.33%"` |
| `formatSignedPct(-25)` | `"-25.00%"` |
| `formatSignedPct(0)` | `"0.00%"` |

### 4.3 `tests/dca.test.ts`

**D1. List, no fee, gain.** `amount 100, fee 0, final 30, list [10, 20, 25, 50]`
→ ok. periods `4`, totalInvested `400`, totalFees `0`, unitsAcquired `21`, avgCostInclFees `19.047619047619047`, avgPriceExclFees `19.047619047619047`, currentValue `630`, pnl `230`, pnlPct `57.5`. rows[1]: cumUnits `15`, cumInvested `200`, avgCost `13.333333333333334`.

**D2. List, 1% fee.** Same as D1 with `fee 1`
→ totalFees `4`, netInvested `396`, unitsAcquired `20.79`, avgCostInclFees `19.240019240019237`, avgPriceExclFees `19.047619047619047`, currentValue `623.7`, pnl `223.7`, pnlPct `55.925`. rows[0]: fee `1`, units `9.9`.

**D3. List, loss.** `amount 100, fee 0, final 10, list [10, 20]`
→ unitsAcquired `15`, totalInvested `200`, avgCostInclFees `13.333333333333334`, currentValue `150`, pnl `-50`, pnlPct `-25`.

**D4. Growth +10%.** `amount 100, fee 0, final 121, growth start 100, change 10, periods 3`
→ prices `[100, 110, 121]` (closeTo), unitsAcquired `2.7355371900826446`, avgCostInclFees `109.66767371601209`, currentValue `331`, pnl `31`, pnlPct `10.333333333333334`.

**D5. Growth −50% with fee.** `amount 100, fee 0.5, final 80, growth start 100, change -50, periods 2`
→ prices `[100, 50]`, totalInvested `200`, totalFees `1`, unitsAcquired `2.985`, avgCostInclFees `67.00167504187606`, avgPriceExclFees `66.66666666666667`, currentValue `238.8`, pnl `38.8`, pnlPct `19.4`.

**D6. Snap to zero.** `amount 100, fee 0, final 7, list [7,7,7,7,7,7,7]`
→ pnl exactly `0` and pnlPct exactly `0` (`toBe(0)`). (Raw float result is `1.1368683772161603e-13`.)

**D7. Blank rows.** `amount 100, fee 0, final 20, list [null, 10, null, 20]`
→ ok, periods `2`, unitsAcquired `15`, notes `[{ code: "blank_rows_ignored", message: "2 blank rows ignored." }]`.

**D8. One blank row.** list `[10, null]` → note message `"1 blank row ignored."`.

Validation cases (assert `status` and the `{field, code, row?}` set; check `message` equals the table in 2.4 for at least one case per code):

| Case | Input change from D1 | Expected |
|---|---|---|
| D9 | amount `null` | `empty`, missing `["amount"]` |
| D10 | amount `0` | `invalid`, `{amount, not_positive}` |
| D11 | amount `-5` | `invalid`, `{amount, not_positive}` |
| D12 | amount `NaN` | `invalid`, `{amount, not_a_number}` |
| D13 | amount `1e12 + 1` | `invalid`, `{amount, too_large}` |
| D14 | fee `100` | `invalid`, `{fee, fee_out_of_range}` |
| D15 | fee `-0.1` | `invalid`, `{fee, fee_out_of_range}` |
| D16 | fee `0` | `ok` |
| D17 | final `0` | `invalid`, `{final, not_positive}` |
| D18 | list `[null, null]` | `empty`, missing `["prices"]` |
| D19 | list `[]` | `empty`, missing `["prices"]` |
| D20 | list `[10, 0]` | `invalid`, `{prices, not_positive, row: 1}` |
| D21 | list `[10, NaN, -3]` | `invalid`, errors `{prices, not_a_number, row: 1}` and `{prices, not_positive, row: 2}` |
| D22 | list of 121 × `10` | `invalid`, `{prices, too_many_rows}`, message `"Use at most 120 rows."` |
| D23 | amount `null` AND fee `150` | `invalid`, errors include `{amount, required}` and `{fee, fee_out_of_range}` |
| D24 | growth start 100, change 0, periods `0` | `invalid`, `{periods, periods_out_of_range}` |
| D25 | growth periods `2.5` | `invalid`, `{periods, periods_out_of_range}` |
| D26 | growth periods `601` | `invalid`, `{periods, periods_out_of_range}` |
| D27 | growth change `-100` | `invalid`, `{change, change_out_of_range}` |
| D28 | growth change `1000.01` | `invalid`, `{change, change_out_of_range}` |
| D29 | growth start 100, change `-99`, periods `600` | `invalid`, `{change, price_path_invalid}` |
| D30 | growth start 100, change `1000`, periods `600` | `invalid`, `{change, price_path_invalid}` |
| D31 | list mode with start/change/periods all `null` | `ok` (they are ignored in list mode) |
| D32 | growth start 100, change 0, periods 12 (amount 100, fee 0, final 100) | `ok`, pnl `0`, unitsAcquired `12`, all prices `100` |

`buildGrowthPrices(100, 10, 3)` → `[100, 110.00000000000001, 121.00000000000001]` (closeTo each).

### 4.4 `tests/breakeven.test.ts`

| Case | Input (entry, buyFee, sellFee, target) | Expected |
|---|---|---|
| B1 | 100, 0, 0, null | breakEvenPrice `100`, breakEvenMovePct `0`, targetPrice `null`, targetMovePct `null`, costPerUnit `100` |
| B2 | 100, 0.1, 0.1, null | breakEvenPrice `100.2003004005006`, breakEvenMovePct `0.20030040050058595` (closeTo 9) |
| B3 | 100, 1, 1, 10 | costPerUnitInclBuyFee `101.01010101010101`, breakEvenPrice `102.03040506070809`, targetPrice `112.2334455667789`, targetMovePct `12.2334455667789` |
| B4 | 25000, 0.4, 0.4, 20 | costPerUnitInclBuyFee `25100.4016064257`, targetPrice `30241.447718585183` (closeTo 6) |
| B5 | 100, 0, 0, -10 | targetPrice `90`, targetMovePct `-10` |
| B6 | 100, 0, 0, 0 | targetPrice `100` |
| B7 | `null`, 0.1, 0.1, 10 | `empty`, missing `["entry"]` |
| B8 | 0, 0.1, 0.1, 10 | `invalid`, `{entry, not_positive}` |
| B9 | 100, 100, 0, null | `invalid`, `{buyFee, fee_out_of_range}` |
| B10 | 100, 0, 100, null | `invalid`, `{sellFee, fee_out_of_range}` |
| B11 | 100, -1, 0, null | `invalid`, `{buyFee, fee_out_of_range}` |
| B12 | 100, 0, 0, -100 | `invalid`, `{target, target_out_of_range}` |
| B13 | 100, 0, 0, 10001 | `invalid`, `{target, target_out_of_range}` |
| B14 | 100, 0, 0, NaN | `invalid`, `{target, not_a_number}` |
| B15 | 100, `null`, 0, null | `empty`, missing `["buyFee"]` |

### 4.5 `tests/drawdown.test.ts`

| Case | Input | Expected |
|---|---|---|
| W1 | V 1000, `[10, 20, 50, 75, 90, 100]` | valueAfter `[900, 800, 500, 250, 100, 0]`; loss `[100, 200, 500, 750, 900, 1000]`; recoveryGainPct `[11.11111111111111, 25, 100, 300, 900, null]`; recoverable last `false`, others `true` |
| W2 | V 1000, `[0]` | valueAfter `1000`, loss `0`, recovery `0` |
| W3 | V 1000, `[99]` | valueAfter `10`, recovery `9900` |
| W4 | V 1000, `[10, null, 20]` | ok, rows sourceIndex `[0, 2]`, note `"1 blank row ignored."` |
| W5 | V 1000, `[20, 10]` | order preserved: drawdownPct `[20, 10]` |
| W6 | V 1000, `[-5]` | `invalid`, `{drawdowns, drawdown_out_of_range, row: 0}` |
| W7 | V 1000, `[100.01]` | `invalid`, `{drawdowns, drawdown_out_of_range, row: 0}` |
| W8 | V 0, `[10]` | `invalid`, `{value, not_positive}` |
| W9 | V `null`, `[10]` | `empty`, missing `["value"]` |
| W10 | V 1000, `[null, null]` | `empty`, missing `["drawdowns"]` |
| W11 | V 1000, 21 × `[10]` | `invalid`, `{drawdowns, too_many_rows}`, message `"Use at most 20 rows."` |
| W12 | V 1000, `[NaN]` | `invalid`, `{drawdowns, not_a_number, row: 0}` |

### 4.6 `tests/url-state.test.ts`

| Case | Input | Expected |
|---|---|---|
| U1 | `parseQuery("")` | `state` deep-equals `DEFAULT_STATE`, `hadInvalid false` |
| U2 | `serializeState(DEFAULT_STATE)` | `""` |
| U3 | round trip: change `dca.amount` to `"250"`, `be.target` to `""`, `tab` to `"be"` | `serializeState` → `"?tab=be&dca_amt=250&be_target="`; `parseQuery` of that equals the modified state |
| U4 | `?cur=PHP&dd_value=5000&dd_pcts=10,25,100` | currency `PHP`, `dd.value "5000"`, `dd.pcts ["10","25","100"]` |
| U5 | `?dca_amt=abc` | `dca.amount` = default `"100"`, `hadInvalid true` |
| U6 | `?tab=evil&cur=usd` | tab `dca`, currency `USD`, `hadInvalid true` |
| U7 | `?dd_pcts=10,x,20` | `dd.pcts` = default, `hadInvalid true` |
| U8 | `?dca_prices=` + 121 comma-separated `10`s | `dca.prices.length === 120`, `hadInvalid true` |
| U9 | `?unknown=1&dca_fee=0.5` | `dca.fee "0.5"`, `hadInvalid false` (unknown keys ignored silently) |
| U10 | query string longer than 8000 chars | `state` = `DEFAULT_STATE`, `hadInvalid true` |
| U11 | `?dca_fee=150` | `dca.fee "150"`, `hadInvalid false` (range is the calc's job; the field will show an error) |
| U12 | `?dca_amt=1%2C000` | `dca.amount "1000"` |
| U13 | `?dca_amt=<script>` | default, `hadInvalid true` |
| U14 | duplicate key `?dca_amt=1&dca_amt=2` | first value wins: `"1"` |

---

## 5. UI spec

### 5.1 Page structure (`index.astro`)

Top to bottom, inside `<body class="crt">`:
1. Skip link `Skip to calculator` → `#calculator`.
2. `<header>`: wordmark `RETROHODL` (VT323, amber, glow) followed by a green block cursor `<span class="cursor" aria-hidden="true">█</span>`. Tagline below: `Plain arithmetic on your own numbers.` Right side: CRT toggle button.
3. `<main id="calculator">`:
   - Toolbar: currency select, copy-link button, status text, URL notice (hidden by default).
   - Tabs: `DCA Plan` | `Break-even` | `Drawdown`.
   - Three tab panels.
4. `<footer>`: disclaimer paragraph, font licenses link, year.
5. `<noscript>` message inside `<main>` above the toolbar.

Layout: content max width `1080px`, side padding `--space-4` (16px) on mobile, `--space-6` (32px) at ≥ 900px. Inside each panel: one column below 900px; at ≥ 900px a grid `minmax(0, 5fr) minmax(0, 7fr)` with inputs card left and results card right.

### 5.2 Shared field component (`Field.astro`)

Props: `id`, `label`, `hint?`, `prefix?` (`"currency"` or a literal), `suffix?` (e.g. `"%"`), `optional?`.

Markup:
```html
<div class="field" data-field="{id}">
  <label for="{id}">{label}<span class="optional"> (optional)</span></label>
  <div class="input-wrap">
    <span class="adorn adorn-prefix" data-currency-symbol aria-hidden="true">$</span>
    <input id="{id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
           enterkeyhint="next" aria-describedby="{id}-hint {id}-error" />
    <span class="adorn adorn-suffix" aria-hidden="true">%</span>
  </div>
  <p class="hint" id="{id}-hint">{hint}</p>
  <p class="error" id="{id}-error" hidden></p>
</div>
```
- Only render `.optional`, prefix, suffix, hint when the props are given. If there is no hint, drop that id from `aria-describedby`.
- Error state: set `aria-invalid="true"` on the input, add `.has-error` to `.field`, set the error text, unhide `#{id}-error`. Clearing reverses all four.
- The error `<p>` starts with a visually hidden `Error: ` prefix (`<span class="sr-only">Error: </span>` built with createElement).

### 5.3 Input behaviour (all tabs)

- On `input`: update state string immediately; recompute after 150 ms debounce; write URL after 400 ms debounce.
- **Touched:** a field (or list row) becomes touched on `blur`, or as soon as its value is non-empty. `required` errors show only on touched fields. All other errors show as soon as they exist.
- Each panel is a `<form novalidate>` whose `submit` is `preventDefault()`ed. Enter does nothing harmful.
- Results card has exactly three child containers with `data-state="empty" | "invalid" | "ok"`. Exactly one is visible (others have `hidden`).
- A visually hidden `<p aria-live="polite">` per panel gets a one-sentence summary, debounced 800 ms, only when status is `ok`.
- Each panel has a `Reset` text button at the bottom of the inputs card: restores that tab's defaults, clears touched state, rerenders rows, recomputes, writes URL.
- Each results card ends with `HowCalculated.astro`: a `<details>` with summary `How this is calculated` and the formulas from section 2 in plain text.
- Positive P/L or move: `--color-pos` and a `+` sign and the word `gain`. Negative: `--color-neg`, `-` sign, word `loss`. Zero: `--color-text-muted`, word `no change`. Color is never the only cue.

### 5.4 Toolbar

| Element | Spec |
|---|---|
| Currency | `<label for="currency">Currency symbol</label>` + `<select id="currency">` options `USD ($)`, `PHP (₱)`, `EUR (€)`, values `USD`/`PHP`/`EUR`. Default `USD`. Hint: `Display only. No conversion.` On change: update every `[data-currency-symbol]` text and rerender results. |
| Copy link | `<button id="share-copy" type="button">Copy link</button>`. On click: flush pending URL write, then `navigator.clipboard.writeText(location.href)`. On success set `#share-status` to `Link copied.`; on failure or if `navigator.clipboard` is undefined, show the failure string. `#share-status` has `role="status"` and clears after 4 s. |
| URL notice | `<p id="url-notice" class="notice" hidden>` with the URL notice string and a `Dismiss` button. Shown on boot when `hadInvalid` is true. |

### 5.5 Tabs (`Tabs.astro`, `tabs.ts`)

- WAI-ARIA tabs pattern, automatic activation. `<div role="tablist" aria-label="Calculators">` with three `<button role="tab" id="tab-dca" aria-controls="panel-dca" aria-selected="true|false" tabindex="0|-1">`.
- Panels: `<section role="tabpanel" id="panel-dca" aria-labelledby="tab-dca" tabindex="0">`; inactive panels have `hidden`.
- Keys on a tab: Left/Right move and activate (wrapping), Home/End go to first/last. Tab key moves into the panel.
- Activating a tab updates `state.tab` and writes the URL. IDs: `dca`, `be`, `dd`.

### 5.6 DCA Plan tab (`panel-dca`)

Heading inside panel (VT323): `DCA Plan`. Intro line: `Buy the same amount each period. See what the numbers add up to.`

Inputs card, in this order:

| id | Label | Prefix/suffix | Default | Hint |
|---|---|---|---|---|
| `dca-amount` | `Amount per period` | currency | `100` | `Cash spent each period, fees included.` |
| `dca-fee` | `Fee per buy` | `%` | `0.1` | `Taken out of each amount before buying.` |
| radio group `dca-mode` | legend `Prices` | none | `growth` | options: `dca-mode-growth` label `Start price + % change`; `dca-mode-list` label `Enter each price` |
| `dca-start` (growth only) | `Start price` | currency | `100` | `Price in period 1.` |
| `dca-change` (growth only) | `Change per period` | `%` | `-2` | `Your own assumption. Negative for a falling price.` |
| `dca-periods` | `Number of periods` | none | `12` | growth: `1 to 600.` list: `Set by the number of prices below.` |
| price rows (list only) | `Period {i} price` (visually hidden label, visible `#{i}` badge) | currency | see below | none |
| `dca-final` | `Final price` | currency | `100` | `Price used to value the units. Selling fees are not included; see Break-even.` |

- Radio group is a `<fieldset>` with `<legend>`. Growth fields are wrapped in `<div id="dca-growth-fields">`, list rows in `<div id="dca-list-fields">`; toggle with `hidden`.
- In list mode, `dca-periods` is `disabled` and its value displays the count of non-blank rows.
- **List rows:** `<ol id="dca-rows">`; each `<li>` holds the input `id="dca-price-{i}"` (i 0-based) and a remove button `<button type="button" aria-label="Remove period {i+1} price">×</button>`. Below the list: `<button id="dca-add-row" type="button">Add price</button>`, disabled when there are 120 rows. Row errors render under the row (`id="dca-price-{i}-error"`).
- **Prefill on entering list mode:** if `state.dca.prices` is empty, fill it from `buildGrowthPrices(start, change, periods)` when that growth input is valid, with each price written as `String(Number(p.toPrecision(8)))`, truncated to 120 rows. If growth input is not valid, use three blank rows.
- Remove row: delete it, rerender rows, focus the input that now has the same index, else the previous row, else `dca-add-row`. Add row: append blank row, rerender, focus the new input.
- Rows rerender only on add, remove, reset, or prefill. Typing never rerenders the list.

Results card (`id="dca-results"`):
- `empty`: dashed border box, text per 2.4.
- `invalid`: text per 2.4.
- `ok`:
  - Headline block: label `Profit / loss at final price`, big number `formatSignedMoney(pnl)` in VT323 `--fs-3xl` with glow, then `formatSignedPct(pnlPct)` and the word (`gain` / `loss` / `no change`).
  - `<dl class="stats">` grid (2 columns mobile, 3 at ≥ 600px) with `data-out` slots:

    | Label | Value |
    |---|---|
    | `Total invested` | `formatMoney(totalInvested)` |
    | `Fees paid` | `formatMoney(totalFees)` |
    | `Units acquired` | `formatUnits(unitsAcquired)` |
    | `Avg cost per unit (incl. fees)` | `formatMoney(avgCostInclFees)` |
    | `Avg price paid (excl. fees)` | `formatMoney(avgPriceExclFees)` |
    | `Value at final price` | `formatMoney(currentValue)` |
    | `Periods` | integer |
  - Notes paragraph (muted) if any.
  - `<details>` summary `Per-period table ({n} rows)` containing `<table>` with `<caption class="sr-only">DCA purchases by period</caption>` and columns `#`, `Price`, `Spent`, `Fee`, `Units`, `Total units`, `Avg cost`. Table wrapper scrolls horizontally on narrow screens (`overflow-x: auto`, `tabindex="0"`, `role="region"`, `aria-label="Per-period table"`).
- Live summary: `Profit or loss at final price: {signedMoney} ({signedPct}).`

### 5.7 Break-even tab (`panel-be`)

Heading `Break-even`. Intro: `The sell price that covers your entry and both fees.`

| id | Label | Prefix/suffix | Default | Hint |
|---|---|---|---|---|
| `be-entry` | `Entry price per unit` | currency | `100` | `Price before fees. If your cost already includes fees, set the buy fee to 0.` |
| `be-buy-fee` | `Buy fee` | `%` | `0.1` | none |
| `be-sell-fee` | `Sell fee` | `%` | `0.1` | none |
| `be-target` | `Target gain` (optional) | `%` | `10` | `Gain on total cash spent, after both fees.` |

Results `ok`:
- Headline: label `Break-even sell price`, big `formatMoney(breakEvenPrice)`, sub-line `{formatSignedPct(breakEvenMovePct)} from entry`.
- Stats: `Cost per unit incl. buy fee` → `formatMoney(costPerUnitInclBuyFee)`.
- Target block (only if `targetPrice !== null`): label `Sell price for {formatSignedPct(targetGainPct)} gain`, value `formatMoney(targetPrice)`, sub-line `{formatSignedPct(targetMovePct)} from entry`. If target is blank, show muted text `Add a target gain to see that price.`
- Live summary: `Break-even sell price: {money}.`

### 5.8 Drawdown tab (`panel-dd`)

Heading `Drawdown`. Intro: `How far a position falls, and the gain it takes to get back.`

| id | Label | Prefix/suffix | Default | Hint |
|---|---|---|---|---|
| `dd-value` | `Position value` | currency | `10000` | none |
| rows `dd-pct-{i}` | `Drawdown {i+1}` (visually hidden; visible `#{i+1}` badge) | `%` | `10, 20, 30, 50, 75, 90` | none |

- Rows: `<ol id="dd-rows">`, remove buttons `aria-label="Remove drawdown {i+1}"`, `<button id="dd-add-row">Add drawdown</button>` disabled at 20 rows. Same focus rules as DCA rows. If the user removes every row, show zero rows (results go to empty state).
- Results `ok`: `<table>` with `<caption class="sr-only">Drawdown results</caption>`, columns `Drawdown`, `Value after`, `Amount lost`, `Gain to recover`. Rows in input order. Values: `formatPct(d)`, `formatMoney(valueAfter)`, `formatMoney(loss)`, `formatPct(recoveryGainPct)` or `Not recoverable (value is 0)`. In the `Value after` cell, under the number, a decorative bar `<span class="bar" aria-hidden="true">` with `style.width = (100 − d) + "%"` set via JS (`el.style.width`, which CSP allows).
- Notes paragraph if any.
- Live summary: `{n} drawdown rows calculated.`

### 5.9 Copy rules (all user-facing text)

- No predictions, signals, or recommendations. Banned (case-insensitive, whole word) outside `Footer.astro` and `Disclaimer.astro`: `should`, `recommend*`, `signal*`, `predict*`, `forecast*`, `guarantee*`, `moon`, `bullish`, `bearish`, `undervalued`, `overvalued`, `advice`, `best time`, `opportunity`. `scripts/check-copy.mjs` scans `src/**/*.astro` and `src/lib/calc/messages.ts` and exits 1 on any hit, printing file:line.
- No em dashes (`—`) in user-facing copy. The same script flags `—` in those files.

---

## 6. URL query param schema (`src/lib/url-state.ts`)

```ts
export type TabId = "dca" | "be" | "dd";
export interface AppState {
  tab: TabId;
  currency: Currency;
  dca: { amount: string; fee: string; mode: "growth" | "list"; periods: string;
         start: string; change: string; prices: string[]; final: string };
  be: { entry: string; buyFee: string; sellFee: string; target: string };
  dd: { value: string; pcts: string[] };
}
export const DEFAULT_STATE: AppState;
export function parseQuery(search: string): { state: AppState; hadInvalid: boolean };
export function serializeState(state: AppState): string; // "" or "?k=v&..."
```

State holds **strings** (what the user typed). Defaults:

| Key | State path | Type | Default |
|---|---|---|---|
| `tab` | `tab` | enum `dca\|be\|dd` | `dca` |
| `cur` | `currency` | enum `USD\|PHP\|EUR` (case-sensitive) | `USD` |
| `dca_amt` | `dca.amount` | number | `100` |
| `dca_fee` | `dca.fee` | number | `0.1` |
| `dca_mode` | `dca.mode` | enum `growth\|list` | `growth` |
| `dca_n` | `dca.periods` | number | `12` |
| `dca_start` | `dca.start` | number | `100` |
| `dca_chg` | `dca.change` | number | `-2` |
| `dca_prices` | `dca.prices` | comma list, max 120 | `[]` |
| `dca_final` | `dca.final` | number | `100` |
| `be_entry` | `be.entry` | number | `100` |
| `be_bfee` | `be.buyFee` | number | `0.1` |
| `be_sfee` | `be.sellFee` | number | `0.1` |
| `be_target` | `be.target` | number | `10` |
| `dd_value` | `dd.value` | number | `10000` |
| `dd_pcts` | `dd.pcts` | comma list, max 20 | `["10","20","30","50","75","90"]` |

`serializeState` write order is exactly the table order.

### Parsing (`parseQuery`), safe by construction

1. Strip a leading `?`. If the remaining string is longer than 8000 characters, return `{ state: clone(DEFAULT_STATE), hadInvalid: true }`.
2. `const params = new URLSearchParams(search)`. Start from a deep clone of `DEFAULT_STATE`.
3. For each key in the table above, `params.get(key)` (first value wins). If `null`, keep the default. Unknown keys are ignored and do not set `hadInvalid`.
4. Enums: exact match against the allowed set, otherwise keep default and set `hadInvalid`.
5. Numbers: if the value is `""`, store `""` (user cleared it). Else `parseDecimal(value)`; on `ok` store `normalized`; otherwise keep the default and set `hadInvalid`. Range is **not** checked here.
6. Lists: if the value is `""`, store `[]`. Else split on `,`; if more than the max items, keep the first max and set `hadInvalid`. Parse each item with `parseDecimal`; if any item is not `ok`, keep the whole default list and set `hadInvalid`. Otherwise store the `normalized` strings.
7. Values are only ever put into the DOM via `input.value = ...` or `textContent`. Never as HTML, never as attribute names, never as URLs.

### Writing (`serializeState`)

For each key in order:
- Enum: omit if equal to default, else `key=value`.
- Number field: omit if the string equals the default string; if `trim() === ""` write `key=`; else `parseDecimal`; on `ok` write `normalized`; otherwise omit (falls back to default on reload).
- List: drop items that are blank or not `ok`, map to `normalized`. If the resulting list equals the default list, omit. If empty, write `key=`. Else write the comma-joined list.
- Build with `URLSearchParams` and return `"?" + params.toString()`, or `""` if nothing was written. (Commas will be percent-encoded as `%2C`. That is fine.)

### Browser side

- Boot: `parseQuery(location.search)` → fill inputs → compute all three tabs → show the URL notice if `hadInvalid`.
- On state change (debounced 400 ms): `history.replaceState(null, "", location.pathname + serializeState(state))`. Never `pushState`.
- Canonical link is always `https://retrohodl.xyz/` regardless of query.

---

## 7. Design system

### 7.1 Color tokens (`tokens.css`, on `:root`)

Contrast ratios computed with the WCAG 2.x formula.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--color-bg` | `#0B0D0A` | page background | |
| `--color-surface` | `#12160F` | cards | |
| `--color-surface-2` | `#1A2016` | stat tiles, table header, active tab | |
| `--color-input-bg` | `#0E120C` | input background | |
| `--color-text` | `#E8F0DF` | body text | 16.69 on bg, 14.23 on surface-2 |
| `--color-text-muted` | `#A3B096` | hints, notes, labels | 8.56 on bg, 7.30 on surface-2 |
| `--color-text-faint` | `#7D8A72` | placeholders, footer meta only | 5.34 on bg, 4.56 on surface-2 |
| `--color-amber` | `#FFB000` | primary accent: wordmark, headings, active tab, focus ring, primary button bg | 10.65 on bg, 9.08 on surface-2 |
| `--color-amber-dim` | `#C98A00` | hover borders, secondary accent | 6.61 on bg |
| `--color-green` | `#3DFF7A` | cursor, positive highlights on dark bg | 14.67 on bg |
| `--color-pos` | `#3DFF7A` | positive P/L | 13.76 on surface |
| `--color-neg` | `#FF6B5E` | negative P/L, error text, error border | 6.55 on surface, 5.96 on surface-2 |
| `--color-on-amber` | `#0B0D0A` | text on amber buttons | 10.65 |
| `--color-border` | `#2E3828` | decorative card borders, dividers (not a UI boundary) | |
| `--color-border-input` | `#687A5C` | input, select, button borders (non-text contrast ≥ 3:1) | 4.21 on bg, 3.95 on surface, 3.59 on surface-2 |
| `--glow-amber` | `0 0 2px rgb(255 176 0 / 0.6), 0 0 10px rgb(255 176 0 / 0.35)` | text-shadow on display text | |
| `--glow-green` | `0 0 2px rgb(61 255 122 / 0.6), 0 0 10px rgb(61 255 122 / 0.3)` | cursor | |
| `--ring` | `0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-amber)` | focus ring (box-shadow) | |

Rules: never put body-size text in `--color-amber-dim` on surface-2. Placeholders use `--color-text-faint` and are never the only label.

### 7.2 Spacing, radii, layout

| Token | Value |
|---|---|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |
| `--space-7` | `48px` |
| `--space-8` | `64px` |
| `--radius-sm` | `6px` (inputs, buttons) |
| `--radius-md` | `10px` (stat tiles, tabs) |
| `--radius-lg` | `16px` (cards) |
| `--radius-pill` | `999px` (badges) |
| `--content-max` | `1080px` |
| `--tap-min` | `44px` (min height for buttons, inputs, tabs) |

Breakpoints (min-width, mobile-first): `600px` (stats 3 columns), `900px` (two-column panel, larger type).

Card: `background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-5)` (`--space-6` at ≥ 900px). Gap between fields `--space-5`.

### 7.3 Type

| Token | Value |
|---|---|
| `--font-display` | `"VT323", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace` |
| `--font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `--fs-xs` | `0.8125rem` (13px) |
| `--fs-sm` | `0.875rem` (14px) |
| `--fs-base` | `1rem` (16px) |
| `--fs-lg` | `1.25rem` (20px) |
| `--fs-xl` | `1.5rem` (24px) |
| `--fs-2xl` | `2rem` (32px) |
| `--fs-3xl` | `2.75rem` (44px); `3.25rem` at ≥ 900px |
| `--fs-display` | `3rem` (48px); `4rem` at ≥ 900px |
| `--lh-tight` | `1.1` |
| `--lh-base` | `1.5` |

Usage:
- Wordmark: `--font-display`, `--fs-display`, amber, glow, letter-spacing `0.04em`.
- Panel headings (h2): `--font-display`, `--fs-2xl`, amber, glow.
- Big result numbers: `--font-display`, `--fs-3xl`, `--color-text` with amber glow (or pos/neg color with matching glow for P/L).
- Inputs, stat values, table cells: `--font-mono`, `--fs-base` (inputs must be ≥ 16px so iOS does not zoom), `font-variant-numeric: tabular-nums`.
- Body copy, labels, hints: `--font-sans`. Labels `--fs-sm` weight 600, hints `--fs-sm` muted.
- VT323 only for text ≥ 24px. Never for body or labels.

### 7.4 Fonts: choice, license, self-hosting

| Family | Role | License | Package |
|---|---|---|---|
| VT323 (Peter Hull) | display | SIL Open Font License 1.1 | `@fontsource/vt323` |
| JetBrains Mono (JetBrains) | numbers, inputs | SIL Open Font License 1.1 | `@fontsource/jetbrains-mono` |

Both licenses allow bundling and serving the fonts from your own domain. Do not rename the fonts. Ship the license text.

Steps:
1. `npm install --save-exact @fontsource/vt323@5 @fontsource/jetbrains-mono@5`
2. `src/styles/fonts.css`:
   ```css
   @import "@fontsource/vt323/400.css";
   @import "@fontsource/jetbrains-mono/400.css";
   @import "@fontsource/jetbrains-mono/700.css";
   ```
   These CSS files declare `@font-face` with `unicode-range` per subset. Vite copies the `.woff2` files into `dist/_astro/`, so they are served from retrohodl.xyz. The browser downloads only the subsets it needs (`₱` U+20B1 is in the latin-ext subset of JetBrains Mono).
3. Import `fonts.css` once in `Base.astro` (frontmatter `import "../styles/fonts.css";`).
4. Create `public/licenses/fonts.txt`: a header line per family (`VT323, Copyright 2011 The VT323 Project Authors` and `JetBrains Mono, Copyright 2020 The JetBrains Mono Project Authors`, copy the exact copyright lines from each package's `LICENSE` file in `node_modules`), then the full OFL 1.1 text copied from `node_modules/@fontsource/vt323/LICENSE`.
5. Footer links to `/licenses/fonts.txt` with text `Font licenses`.
6. Verify: `grep -rE "fonts.googleapis|fonts.gstatic|cdn" dist` returns nothing; `ls dist/_astro/*.woff2` lists files.

### 7.5 Scanlines, glow, motion (`crt.css`)

Approach: everything is CSS on pseudo-elements of `body.crt`. No canvas, no JS animation.

```css
/* static scanlines + vignette, above content, never intercepts input */
body.crt::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  background:
    repeating-linear-gradient(
      to bottom,
      rgb(0 0 0 / 0) 0px,
      rgb(0 0 0 / 0) 2px,
      rgb(0 0 0 / 0.16) 2px,
      rgb(0 0 0 / 0.16) 3px
    ),
    radial-gradient(ellipse at center, rgb(0 0 0 / 0) 60%, rgb(0 0 0 / 0.35) 100%);
}

/* slow faint roll band: the only ambient motion */
body.crt::after {
  content: "";
  position: fixed;
  left: 0;
  right: 0;
  top: -20vh;
  height: 20vh;
  pointer-events: none;
  z-index: 1001;
  background: linear-gradient(to bottom, rgb(255 176 0 / 0), rgb(255 176 0 / 0.035), rgb(255 176 0 / 0));
  animation: crt-roll 9s linear infinite;
}
@keyframes crt-roll { to { transform: translateY(140vh); } }

.glow { text-shadow: var(--glow-amber); }

.cursor { color: var(--color-green); text-shadow: var(--glow-green); animation: blink 1.1s steps(1, end) infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* Reduced motion: no animation at all. Static scanlines stay. */
@media (prefers-reduced-motion: reduce) {
  body.crt::after { display: none; }
  .cursor { animation: none; }
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
}

/* Higher contrast requested, or user switched effects off: remove overlays and glow */
@media (prefers-contrast: more) {
  body.crt::before, body.crt::after { display: none; }
  .glow, .cursor { text-shadow: none; }
}
html.fx-off body.crt::before, html.fx-off body.crt::after { display: none; }
html.fx-off .glow, html.fx-off .cursor { text-shadow: none; }

@media (forced-colors: active) {
  body.crt::before, body.crt::after { display: none; }
}
@media print {
  body.crt::before, body.crt::after { display: none; }
}
```

- CRT toggle: `<button id="crt-toggle" type="button" aria-pressed="true">CRT effects</button>`. Click toggles `fx-off` on `<html>` and flips `aria-pressed`. Not saved anywhere.
- Glow (`.glow`) goes on the wordmark, panel h2s, and big result numbers only. Never on body text, labels, or inputs.
- No flicker, no screen shake, no text jitter. Hover/focus transitions ≤ 150 ms.
- Focus: `:focus-visible { outline: 2px solid var(--color-amber); outline-offset: 2px; }` on all interactive elements. Never `outline: none` without this replacement.
- `[hidden] { display: none !important; }` in `base.css`.
- `.sr-only` standard visually-hidden utility in `base.css`.

---

## 8. SEO and meta

In `Base.astro` `<head>` (exact values):

```html
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RetroHODL | DCA, Break-even and Drawdown Calculator</title>
<meta name="description" content="Work out DCA cost basis, break-even price after fees, and drawdown recovery. Runs in your browser on the numbers you enter. No sign-up, no tracking." />
<link rel="canonical" href="https://retrohodl.xyz/" />
<meta name="color-scheme" content="dark" />
<meta name="theme-color" content="#0B0D0A" />
<meta name="robots" content="index, follow" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="RetroHODL" />
<meta property="og:url" content="https://retrohodl.xyz/" />
<meta property="og:title" content="RetroHODL | DCA, Break-even and Drawdown Calculator" />
<meta property="og:description" content="Plain arithmetic on your own numbers. DCA cost basis, break-even after fees, drawdown recovery. Runs in your browser." />
<meta property="og:image" content="https://retrohodl.xyz/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="RetroHODL wordmark in amber terminal text on a black background with scanlines." />
<meta name="twitter:card" content="summary_large_image" />
```

`<html lang="en">`. One `<h1>` (the wordmark, text `RetroHODL` visually styled uppercase via `text-transform`).

### Favicon (`public/favicon.svg`, exact)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" rx="6" fill="#0B0D0A"/>
  <g fill="#FFB000">
    <rect x="6" y="8" width="4" height="4"/>
    <rect x="10" y="12" width="4" height="4"/>
    <rect x="14" y="16" width="4" height="4"/>
    <rect x="10" y="20" width="4" height="4"/>
    <rect x="6" y="24" width="4" height="4"/>
  </g>
  <rect x="18" y="24" width="10" height="4" fill="#3DFF7A"/>
</svg>
```

### OG image source (`assets-src/og.svg`, exact)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" y="3" fill="#000" fill-opacity="0.25"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="#0B0D0A"/>
  <rect x="60" y="60" width="1080" height="510" rx="24" fill="#12160F" stroke="#2E3828" stroke-width="2"/>
  <text x="120" y="290" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="120" font-weight="700" fill="#FFB000">RETROHODL</text>
  <rect x="860" y="200" width="56" height="96" fill="#3DFF7A"/>
  <text x="124" y="380" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="40" fill="#E8F0DF">DCA · Break-even · Drawdown</text>
  <text x="124" y="450" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="30" fill="#A3B096">Plain arithmetic on your own numbers.</text>
  <rect width="1200" height="630" fill="url(#scan)"/>
</svg>
```

`scripts/make-images.mjs` (run once with `npm run images`, outputs committed, not part of the build):
- `sharp("assets-src/og.svg").png().toFile("public/og.png")`
- `sharp("public/favicon.svg", { density: 512 }).resize(180, 180).png().toFile("public/apple-touch-icon.png")`
- `sharp("public/favicon.svg", { density: 256 }).resize(32, 32).png().toFile("public/favicon-32.png")`
- If the wordmark overlaps the cursor block in the rendered PNG, move the cursor `rect` x until there is a 24px gap. That is the only allowed adjustment.

### `public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://retrohodl.xyz/sitemap.xml
```

### `public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://retrohodl.xyz/</loc>
  </url>
</urlset>
```

### Disclaimer

`Disclaimer.astro` (short line, used under the header tagline in muted `--fs-sm`):

> Arithmetic only. Not financial advice.

`Footer.astro` paragraph (exact):

> RetroHODL is a calculator. It does arithmetic on the numbers you type in. It does not know market prices, does not predict anything, and is not financial, investment, tax, or legal advice. Check the results before you rely on them. Your inputs stay in your browser and are not sent or stored anywhere. If you copy a share link, the numbers you entered are part of that link.

Below it: `© 2026 RetroHODL · Font licenses` (link).

### `404.astro`

Uses `Base.astro`. h1 `404`, text `This page does not exist.`, link `Back to the calculators` → `/`. Add `<meta name="robots" content="noindex">` via a `noindex` prop on `Base.astro`.

---

## 9. Build config and Cloudflare Pages

### `astro.config.mjs` (exact)

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://retrohodl.xyz",
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory", inlineStylesheets: "never" },
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
});
```

`inlineStylesheets: "never"` and `assetsInlineLimit: 0` keep all CSS and JS in external files so the CSP needs no `'unsafe-inline'`.

### `package.json` scripts (exact)

```json
{
  "name": "retrohodl",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "test": "vitest run",
    "check": "astro check",
    "lint:copy": "node scripts/check-copy.mjs",
    "build": "npm run lint:copy && vitest run && astro check && astro build",
    "preview": "astro preview",
    "images": "node scripts/make-images.mjs"
  }
}
```

Dependencies (install with `--save-exact`, commit the lockfile):
- `npm install --save-exact astro@5 @fontsource/vt323@5 @fontsource/jetbrains-mono@5`
- `npm install --save-dev --save-exact typescript@5 @astrojs/check vitest@3 sharp`

`tsconfig.json`: `{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist"] }`.

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node" } });
```

`.gitignore`: `node_modules/`, `dist/`, `.astro/`, `.DS_Store`, `*.log`.

### `public/_headers` (exact)

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

https://:project.pages.dev/*
  X-Robots-Tag: noindex
```

`Referrer-Policy: no-referrer` stops the query string (the user's numbers) leaking to any site linked from the page.

### Cloudflare Pages project settings

| Setting | Value |
|---|---|
| Source | GitHub, private repo `retrohodl`, production branch `main` |
| Framework preset | `Astro` (or `None`; the fields below are what matter) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (blank) |
| Build system version | v3 (latest) |
| Environment variable (Production and Preview) | `NODE_VERSION` = `22.12.0` |
| Preview deployments | enabled for all non-production branches (they get `X-Robots-Tag: noindex` from `_headers`) |
| Web Analytics | **off** (Pages project > Metrics; do not enable automatic setup, it injects a third-party beacon) |
| Custom domain | `retrohodl.xyz`; add `www.retrohodl.xyz` and create a Redirect Rule (Cloudflare dashboard > Rules) `www` → apex, 301, preserve query string |

---

## 10. Ordered task list for the executor

Do the tasks in order. Commit after each task with message `T{n}: {title}`. Do not start a task until the previous one meets its acceptance criteria.

**T1. Scaffold the repo**
Create `package.json` (section 9), `.nvmrc` (`22.12.0`), `.gitignore`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`, `src/env.d.ts` (`/// <reference types="astro/client" />`), a placeholder `src/pages/index.astro` that renders `<h1>RetroHODL</h1>`. Install deps exactly as listed. Temporarily set the `build` script to `astro build` until T8.
*Accept:* `npm run dev` serves the page; `npm run build` creates `dist/index.html`; `package.json` has no `^` or `~` versions.

**T2. `parse.ts` + tests**
Implement `parseDecimal` and `toCalcInput` per 2.2. Write `tests/parse.test.ts` from 4.1.
*Accept:* `npm test` passes all 4.1 cases.

**T3. `format.ts` + tests**
Implement per section 3 formatting rules. Write `tests/format.test.ts` from 4.2.
*Accept:* all 4.2 cases pass.

**T4. Calc types, limits, messages**
Create `types.ts`, `limits.ts`, `messages.ts` with every string from 2.4 exactly.
*Accept:* `npx tsc --noEmit -p .` (or `astro check`) passes; `errorMessage("too_many_rows", "prices", { max: 120 })` returns `"Use at most 120 rows."` (add one test to `dca.test.ts` later or a quick assertion in `parse.test.ts`).

**T5. `dca.ts` + tests**
Implement `buildGrowthPrices` and `calcDca` per 2.3 and 2.5. Write `tests/dca.test.ts` D1 to D32.
*Accept:* all pass. No DOM globals in `src/lib`.

**T6. `breakeven.ts` + tests**
Per 2.6, tests B1 to B15.
*Accept:* all pass.

**T7. `drawdown.ts` + tests**
Per 2.7, tests W1 to W12. Add `calc/index.ts` re-exports.
*Accept:* all pass.

**T8. `url-state.ts` + tests, and copy check**
Implement per section 6, tests U1 to U14. Write `scripts/check-copy.mjs` per 5.9. Set the final `build` script.
*Accept:* `npm test` green; `npm run lint:copy` exits 0 on the current tree and exits 1 if you temporarily add the word `forecast` to an `.astro` file (revert after checking).

**T9. Tokens, fonts, base styles**
Create `tokens.css`, `fonts.css`, `base.css` per section 7. `Base.astro` imports them and renders the full `<head>` from section 8 (images may 404 until T19).
*Accept:* page background is `#0B0D0A`; headings render in VT323 and an input renders in JetBrains Mono (check DevTools > Computed > Rendered Fonts); `dist` contains `.woff2` files; no external font requests in the Network panel.

**T10. Layout shell: Header, Footer, Disclaimer, skip link, noscript**
Per 5.1 and section 8 copy.
*Accept:* Tab from page load focuses the skip link first; activating it moves focus to `#calculator`; footer text matches section 8 exactly.

**T11. CRT layer**
`crt.css` per 7.5, CRT toggle button.
*Accept:* scanlines visible; roll band moves; with DevTools "Emulate prefers-reduced-motion: reduce" the band is gone and the cursor does not blink; with "prefers-contrast: more" overlays and glow are gone; toggle button flips `aria-pressed` and removes overlays; clicking through the overlay on an input still focuses the input.

**T12. Field component and component styles**
`Field.astro`, `components.css` (cards, fields, adornments, buttons, stats grid, tables, notices, results states).
*Accept:* a sample field shows label, prefix, suffix, hint; setting the error state by hand in DevTools shows red border, error text, and `aria-invalid="true"`; input text is 16px; every input/button is at least 44px tall.

**T13. Tabs**
`Tabs.astro` + `tabs.ts` per 5.5, three empty panels.
*Accept:* mouse click switches panels; Left/Right/Home/End work and wrap; only the active tab has `tabindex="0"`; axe DevTools (or Lighthouse accessibility) reports no tab-related violations.

**T14. Store, DOM helpers, toolbar, URL sync**
`store.ts`, `dom.ts`, `toolbar.ts`, `main.ts` boot. Currency select, copy link, URL notice, `replaceState` writes.
*Accept:* loading `/?cur=PHP&tab=dd` selects PHP and the Drawdown tab; changing currency updates the URL to include `cur=PHP` within 0.5 s; `/?cur=xx` shows the URL notice and Dismiss hides it; Copy link shows `Link copied.`; reload restores the same state.

**T15. DCA panel**
`DcaPanel.astro` + `dca-ui.ts` per 5.3 and 5.6, including list rows, prefill, focus rules, per-period table, live summary, Reset.
*Accept:* defaults show P/L for 12 periods at −2%; switching to list mode prefills 12 rows; entering D1 values (list 10, 20, 25, 50; fee 0; final 30; amount 100) shows `+$230.00`, `+57.50%`, `gain`, units `21`, avg cost `$19.05`; typing `0` in a price row shows `Must be greater than 0.` under that row and the results show `1 input needs fixing. Check the highlighted fields.`; clearing Amount shows no error until blur, then `Enter a value.`; Add row is disabled at 120 rows; the URL reproduces the state after reload.

**T16. Break-even panel**
Per 5.7.
*Accept:* defaults show `$100.20` break-even and `+0.20% from entry`; B3 inputs show `$102.03` and target `$112.23` / `+12.23% from entry`; clearing Target shows `Add a target gain to see that price.` with no error; buy fee `100` shows the fee message.

**T17. Drawdown panel**
Per 5.8.
*Accept:* defaults show 6 rows; W1 inputs (value 1000) show `11.11%`, `25.00%`, `100.00%`, `300.00%`, `900.00%`, `Not recoverable (value is 0)`; bars shrink with deeper drawdowns; `-5` shows `Drawdown must be from 0% to 100%.` under that row; removing all rows shows `Add at least one drawdown % to see results.`; Add is disabled at 20 rows.

**T18. HowCalculated blocks**
One per panel, plain-text formulas from section 2.
*Accept:* each panel has a working `<details>`; `npm run lint:copy` passes.

**T19. Images, robots, sitemap, headers, 404**
Create `assets-src/og.svg`, `public/favicon.svg`, `scripts/make-images.mjs`, run `npm run images`, commit PNGs. Add `robots.txt`, `sitemap.xml`, `_headers`, `404.astro`, `public/licenses/fonts.txt`.
*Accept:* `dist/` contains `og.png` (1200x630), `favicon-32.png`, `apple-touch-icon.png`, `robots.txt`, `sitemap.xml`, `_headers`, `404.html`, `licenses/fonts.txt`.

**T20. CSP and privacy verification**
*Accept (all must hold on `dist/`):*
- `grep -c "<script" dist/index.html` matches the number of `<script ... src=` tags (no inline scripts): run `grep -o "<script[^>]*>" dist/index.html` and confirm every one has `src=`.
- `grep -o "<style" dist/index.html` returns nothing and `grep -o ' style="' dist/index.html` returns nothing.
- `grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon" src` returns nothing.
- `grep -rnE "https?://" dist --include=*.html --include=*.js --include=*.css` shows only `retrohodl.xyz` URLs and the sitemaps.org / w3.org namespace strings.
- Optional: `npx wrangler pages dev dist` and confirm zero CSP errors in the console while using all three tabs.
If an inline script or style still appears, fix the cause (do not add `'unsafe-inline'`). If it cannot be removed, add `'unsafe-inline'` to `style-src` only and leave a `TODO(plan):` note in `_headers`.

**T21. Accessibility and responsive pass**
*Accept:* Lighthouse (mobile) Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95; no horizontal page scroll at 320px width (tables scroll inside their wrapper); every field reachable and operable by keyboard alone; VoiceOver or NVDA reads label, hint, and error for a field in error; 200% browser zoom keeps all content usable.

**T22. README and Cloudflare deploy**
README: what the site is, `npm install`, `npm run dev`, `npm test`, `npm run build`, deploy settings table from section 9, the out-of-scope list. Configure the Pages project per section 9.
*Accept:* the production URL loads; response headers include the CSP from `_headers`; `https://<project>.pages.dev/` returns `X-Robots-Tag: noindex`; no request in the Network panel goes to any host other than `retrohodl.xyz`; a share link opened in a private window reproduces the state.

---

## 11. Out of scope for v1

- Price APIs or any network request at runtime (enforced by `connect-src 'none'`).
- Wallet connect, exchange connections, portfolio import.
- Accounts, login, saved plans, server-side storage.
- Analytics, error tracking, tag managers, cookies, consent banners (none needed since nothing is collected).
- `localStorage` / `sessionStorage` / IndexedDB of any kind.
- FX conversion between currencies.
- Charts (tables only in v1).
- Tax lots, realized vs unrealized splits, staking yield, compounding contributions, variable buy amounts per period.
- Light theme.
- i18n and locale-aware number entry (decimal comma).
- Any text that predicts prices, suggests actions, or labels an outcome as good or bad.

## 12. v1.1 note: optional spot-price prefill

Goal: a `Use current price` button next to **DCA Final price** and **Break-even Entry price** that fills the field with a spot price for an asset the user picks. Calculation logic does not change; the fetched number is written into the input like typed text and the user can edit it.

Constraints:
- **Click-only.** No request on page load. The button sits next to an asset `<select>` (short fixed list, e.g. BTC, ETH, SOL) and is the only thing that triggers a request.
- **One public, keyless endpoint**, for example CoinGecko `GET https://api.coingecko.com/api/v3/simple/price?ids={id}&vs_currencies={usd|php|eur}`. The `vs_currencies` value follows the currency selector, which is the one place currency stops being "symbol only". The UI must say `Price from CoinGecko at {local time}. Check it before you rely on it.`
- **CSP change:** `connect-src https://api.coingecko.com` (exact origin, nothing else).
- **Graceful failure:** `AbortController` timeout 5 s; on timeout, non-200, CORS error, rate limit (429), or a response that does not parse to a finite number `> 0`, leave the field unchanged and show `Could not load a price. Enter it yourself.` under the field. The calculators keep working the same either way.
- **Validation of the response:** read only `json[id][vs]`, check `typeof === "number"`, finite, `> 0`, `≤ MAX_MONEY`. Write `String(Number(value.toPrecision(10)))` into the input.
- **Privacy note in the footer:** `If you use "Use current price", your browser asks CoinGecko for that one price. CoinGecko sees your IP address. Nothing else is sent.`
- **No caching** in storage. No polling. No auto-refresh.
- **Not added to the URL** as a fetched flag. The resulting number is in the URL like any typed value.
- Tests: the response validator is a pure function in `src/lib/spot.ts` with unit tests for valid, missing key, string value, `0`, negative, `NaN`, and oversized responses.
