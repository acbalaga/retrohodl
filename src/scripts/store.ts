import { type AppState, cloneState, serializeState } from "../lib/url-state";
import { debounce } from "./dom";

export interface Store {
  readonly state: AppState;
  /** Call after mutating state: schedules the debounced URL write. */
  changed(): void;
  flushUrl(): void;
  onChange(fn: () => void): void;
}

export function createStore(initial: AppState): Store {
  const state = cloneState(initial);
  const listeners: Array<() => void> = [];
  const writeUrl = debounce(() => {
    history.replaceState(null, "", location.pathname + serializeState(state));
  }, 400);
  return {
    state,
    changed() {
      writeUrl();
      for (const fn of listeners) fn();
    },
    flushUrl() {
      writeUrl.flush();
    },
    onChange(fn) {
      listeners.push(fn);
    },
  };
}
