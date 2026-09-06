import { formatNumber, parseCurrencyInput } from "../utils/format.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { showToast } from "../components/toast.js";

/**
 * 금액 입력: focus 시 숫자만, blur 시 콤마 포맷.
 * onChange는 input 때마다 호출되지만, 호출 측에서 전체 re-render 하면 안 됨.
 */
export function bindCurrencyInput(input, onChange) {
  if (!input) return;

  const display = () => {
    const val = parseCurrencyInput(input.value);
    if (input.value.trim() === "") {
      input.value = "";
      return;
    }
    input.value = formatNumber(val);
  };

  input.addEventListener("focus", () => {
    const val = parseCurrencyInput(input.value);
    input.value = val ? String(val) : "";
  });

  input.addEventListener("blur", display);

  input.addEventListener("input", () => {
    onChange?.(parseCurrencyInput(input.value));
  });

  // 초기 표시만 (focus 중이 아닐 때)
  if (document.activeElement !== input) {
    display();
  }
}

export function wireCopyAndReset(root, getResultText, onReset) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "copy-result") {
      const text = getResultText();
      const ok = await copyToClipboard(text);
      showToast(ok ? "결과가 복사되었습니다." : "복사에 실패했습니다.");
    }
    if (action === "reset") {
      onReset?.();
      showToast("입력이 초기화되었습니다.");
    }
  });
}
