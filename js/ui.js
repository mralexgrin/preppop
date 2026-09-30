// DOM helpers shared by views, plus the router's per-view hooks.

export const app = document.getElementById("app");
const toastEl = document.getElementById("toast");

// A view sets these; the router runs cleanup and checks leaveGuard on navigation.
export const view = { cleanup: null, leaveGuard: null };

let toastTimer;
export function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

export function setTitle(title) {
  document.title = title ? `${title} · PrepPop` : "PrepPop";
}

export function statusChip(status) {
  if (status === "known") return `<span class="chip know">Known</span>`;
  if (status === "learning") return `<span class="chip learn">Still learning</span>`;
  return `<span class="chip new">New</span>`;
}
