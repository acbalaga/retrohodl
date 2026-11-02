import type { TabId } from "../lib/url-state";

const ORDER: TabId[] = ["dca", "be", "dd"];

export function setActiveTab(id: TabId): void {
  for (const t of ORDER) {
    const tab = document.getElementById(`tab-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (!tab || !panel) continue;
    const active = t === id;
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
  }
}

/** WAI-ARIA tabs, automatic activation. `onActivate` is called after a user-driven change. */
export function initTabs(onActivate: (id: TabId) => void): void {
  const list = document.querySelector<HTMLElement>('[role="tablist"]');
  if (!list) return;
  const activate = (id: TabId, focus: boolean) => {
    setActiveTab(id);
    if (focus) document.getElementById(`tab-${id}`)?.focus();
    onActivate(id);
  };
  list.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[role="tab"]');
    const id = btn?.dataset.tab as TabId | undefined;
    if (id && ORDER.includes(id)) activate(id, false);
  });
  list.addEventListener("keydown", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[role="tab"]');
    const cur = btn?.dataset.tab as TabId | undefined;
    if (!cur) return;
    const i = ORDER.indexOf(cur);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % ORDER.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + ORDER.length) % ORDER.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ORDER.length - 1;
    if (next < 0) return;
    e.preventDefault();
    activate(ORDER[next], true);
  });
}
