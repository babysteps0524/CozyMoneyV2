export function formatNumber(value, decimals = 0) {
  if (value == null || Number.isNaN(Number(value))) return "0";
  return Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(value, decimals = 0) {
  return `${formatNumber(value, decimals)}원`;
}

export function formatPercent(value, decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) return "0%";
  return `${Number(value).toFixed(decimals)}%`;
}

export function parseCurrencyInput(raw) {
  if (raw == null) return 0;
  const cleaned = String(raw).replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

export function parseNumberInput(raw) {
  if (raw == null || raw === "") return null;
  const cleaned = String(raw).replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}
