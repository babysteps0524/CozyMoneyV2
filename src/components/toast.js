let toastEl = null;
let hideTimer = null;

export function showToast(message, duration = 2200) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "cm-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.className =
      "fixed bottom-6 left-1/2 z-9999 -translate-x-1/2 px-4 py-2.5 bg-cm-primary text-white text-14px font-semibold rounded-cm-btn shadow-cm pointer-events-none opacity-0 transition-opacity duration-200";
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = message;
  toastEl.classList.remove("opacity-0");
  toastEl.classList.add("opacity-100");

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toastEl.classList.remove("opacity-100");
    toastEl.classList.add("opacity-0");
  }, duration);
}
