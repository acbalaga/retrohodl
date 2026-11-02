import { parseQuery } from "../lib/url-state";
import { createStore } from "./store";
import { setActiveTab, initTabs } from "./tabs";
import { initCrtToggle, initToolbar } from "./toolbar";

interface PanelHandle {
  render(): void;
}

function boot(): void {
  const { state, hadInvalid } = parseQuery(location.search);
  const store = createStore(state);
  const panels: PanelHandle[] = [];

  initCrtToggle();
  setActiveTab(store.state.tab);
  initTabs((id) => {
    store.state.tab = id;
    store.changed();
  });
  initToolbar(store, { hadInvalid, onCurrencyChange: () => panels.forEach((p) => p.render()) });
  panels.forEach((p) => p.render());
}

boot();
