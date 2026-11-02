export function initCrtToggle(): void {
  const btn = document.getElementById("crt-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const off = document.documentElement.classList.toggle("fx-off");
    btn.setAttribute("aria-pressed", off ? "false" : "true");
  });
}
