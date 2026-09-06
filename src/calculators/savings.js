import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "../utils/format.js";
import { SAVINGS_TAX_RATES } from "../config/financialRates.js";
import { wireCopyAndReset, bindCurrencyInput } from "./shared.js";

function monthsFrom(periodValue, unit) {
  return unit === "year"
    ? Math.round(periodValue * 12)
    : Math.round(periodValue);
}

function calcDeposit(principal, months, annualRate, taxType) {
  const r = annualRate / 100;
  const years = months / 12;
  const interestPre = principal * r * years;
  const taxRate = SAVINGS_TAX_RATES[taxType] ?? SAVINGS_TAX_RATES.normal;
  const tax = interestPre * taxRate;
  const interestAfter = interestPre - tax;
  const maturity = principal + interestAfter;
  return { principal, interestPre, tax, interestAfter, maturity, taxRate };
}

function calcInstallment(monthly, months, annualRate, taxType) {
  const r = annualRate / 100 / 12;
  let balance = 0;
  let interestPre = 0;
  for (let i = 0; i < months; i++) {
    balance += monthly;
    interestPre += balance * r;
  }
  const principal = monthly * months;
  const taxRate = SAVINGS_TAX_RATES[taxType] ?? SAVINGS_TAX_RATES.normal;
  const tax = interestPre * taxRate;
  const interestAfter = interestPre - tax;
  const maturity = principal + interestAfter;
  return { principal, interestPre, tax, interestAfter, maturity, taxRate };
}

export function renderSavingsCalculator(container) {
  let state = {
    mode: "deposit",
    amount: 10_000_000,
    monthly: 300_000,
    periodValue: 12,
    periodUnit: "month",
    annualRate: 3.5,
    taxType: "normal",
  };

  let lastResult = null;
  let lastCmp = null;
  let eventsBound = false;

  function compute() {
    const m = monthsFrom(state.periodValue, state.periodUnit);
    if (state.mode === "deposit") {
      return calcDeposit(state.amount, m, state.annualRate, state.taxType);
    }
    return calcInstallment(state.monthly, m, state.annualRate, state.taxType);
  }

  function compareTaxFree(result) {
    const m = monthsFrom(state.periodValue, state.periodUnit);
    const free =
      state.mode === "deposit"
        ? calcDeposit(state.amount, m, state.annualRate, "taxFree")
        : calcInstallment(state.monthly, m, state.annualRate, "taxFree");
    return {
      normalMaturity: result.maturity,
      freeMaturity: free.maturity,
      diff: free.maturity - result.maturity,
    };
  }

  function getResultText(result, cmp) {
    return [
      `[예·적금 계산 결과]`,
      `유형: ${state.mode === "deposit" ? "거치식 예금" : "적립식 적금"}`,
      `만기 수령액: ${formatCurrency(Math.round(result.maturity))}`,
      `원금 합계: ${formatCurrency(Math.round(result.principal))}`,
      `세전 이자: ${formatCurrency(Math.round(result.interestPre))}`,
      `세금: ${formatCurrency(Math.round(result.tax))}`,
      `세후 이자: ${formatCurrency(Math.round(result.interestAfter))}`,
      `일반과세 예상: ${formatCurrency(Math.round(cmp.normalMaturity))}`,
      `비과세 예상: ${formatCurrency(Math.round(cmp.freeMaturity))}`,
      `예상 차액: ${formatCurrency(Math.round(cmp.diff))}`,
    ].join("\n");
  }

  function updateResults() {
    const result = compute();
    const cmp = compareTaxFree(result);
    lastResult = result;
    lastCmp = cmp;

    const resultEl = container.querySelector("#sv-result");
    if (resultEl) {
      resultEl.innerHTML = /* html */ `
        <h3 class="text-18px font-bold m-0 mb-3">계산 결과</h3>
        <dl class="grid grid-cols-2 gap-3 m-0 text-14px">
          <div>
            <dt class="text-cm-text-muted m-0">만기 수령액</dt>
            <dd class="m-0 font-bold text-16px">${formatCurrency(Math.round(result.maturity))}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">원금 합계</dt>
            <dd class="m-0 font-bold text-16px">${formatCurrency(Math.round(result.principal))}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">세전 이자</dt>
            <dd class="m-0 font-bold">${formatCurrency(Math.round(result.interestPre))}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">세금 (${formatPercent(result.taxRate * 100)})</dt>
            <dd class="m-0 font-bold">${formatCurrency(Math.round(result.tax))}</dd>
          </div>
          <div class="col-span-2">
            <dt class="text-cm-text-muted m-0">세후 이자</dt>
            <dd class="m-0 font-bold text-cm-accent">${formatCurrency(Math.round(result.interestAfter))}</dd>
          </div>
        </dl>
      `;
    }

    const cmpEl = container.querySelector("#sv-compare");
    if (cmpEl) {
      cmpEl.innerHTML = /* html */ `
        <h3 class="text-16px font-bold m-0 mb-2">일반과세 vs 비과세 비교</h3>
        <p class="text-13px text-cm-text-secondary m-0 mb-3">동일 조건에서 세금 유형만 다르게 계산한 참고 값입니다.</p>
        <dl class="grid grid-cols-2 gap-3 m-0 text-14px">
          <div>
            <dt class="text-cm-text-muted m-0">일반과세 예상 수령액</dt>
            <dd class="m-0 font-bold">${formatCurrency(Math.round(cmp.normalMaturity))}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">비과세 예상 수령액</dt>
            <dd class="m-0 font-bold">${formatCurrency(Math.round(cmp.freeMaturity))}</dd>
          </div>
          <div class="col-span-2">
            <dt class="text-cm-text-muted m-0">예상 차액</dt>
            <dd class="m-0 font-bold text-cm-accent">${formatCurrency(Math.round(cmp.diff))}</dd>
          </div>
        </dl>
      `;
    }
  }

  function bindMoneyInputs() {
    for (const id of ["sv-amount", "sv-monthly"]) {
      const el = container.querySelector("#" + id);
      if (!el) continue;
      // 재마운트 시 리스너 중복 방지
      const fresh = el.cloneNode(true);
      el.replaceWith(fresh);
      bindCurrencyInput(fresh, (v) => {
        if (id === "sv-amount") state.amount = v;
        else state.monthly = v;
        updateResults();
      });
    }
  }

  function mount() {
    // 탭 전환 시 폼 구조가 바뀌므로 이때만 전체 재구성
    container.innerHTML = /* html */ `
      <div class="calculatorCard">
        <h2 class="text-24px font-bold text-cm-text mb-2 m-0">예금/적금 계산기</h2>
        <p class="text-14px text-cm-text-secondary m-0 mb-4">거치식·적립식 지원. 세율은 설정 객체에서 관리됩니다.</p>

        <div class="flex gap-2 mb-5">
          <button type="button" class="${state.mode === "deposit" ? "primaryButton" : "secondaryButton"}" data-mode="deposit">거치식 예금</button>
          <button type="button" class="${state.mode === "installment" ? "primaryButton" : "secondaryButton"}" data-mode="installment">적립식 적금</button>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          ${
            state.mode === "deposit"
              ? `
            <div>
              <label class="block text-13px font-semibold mb-1.5" for="sv-amount">예치금액</label>
              <input id="sv-amount" type="text" inputmode="numeric" class="calculatorInput" value="${formatNumber(state.amount)}" />
            </div>`
              : `
            <div>
              <label class="block text-13px font-semibold mb-1.5" for="sv-monthly">월 납입액</label>
              <input id="sv-monthly" type="text" inputmode="numeric" class="calculatorInput" value="${formatNumber(state.monthly)}" />
            </div>`
          }

          <div>
            <label class="block text-13px font-semibold mb-1.5" for="sv-rate">연 이율 (%)</label>
            <input id="sv-rate" type="number" step="0.01" min="0" class="calculatorInput" value="${state.annualRate}" />
          </div>

          <div>
            <label class="block text-13px font-semibold mb-1.5" for="sv-period">기간</label>
            <div class="flex gap-2">
              <input id="sv-period" type="number" min="1" class="calculatorInput flex-1" value="${state.periodValue}" />
              <select id="sv-unit" class="calculatorInput w-24">
                <option value="month" ${state.periodUnit === "month" ? "selected" : ""}>개월</option>
                <option value="year" ${state.periodUnit === "year" ? "selected" : ""}>년</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-13px font-semibold mb-1.5" for="sv-tax">과세 유형</label>
            <select id="sv-tax" class="calculatorInput">
              <option value="normal" ${state.taxType === "normal" ? "selected" : ""}>일반과세 (15.4%)</option>
              <option value="taxFree" ${state.taxType === "taxFree" ? "selected" : ""}>비과세</option>
              <option value="preferential" ${state.taxType === "preferential" ? "selected" : ""}>세금우대 (1.4%)</option>
            </select>
          </div>
        </div>

        <div class="flex gap-2 mt-5">
          <button type="button" class="secondaryButton" data-action="reset">초기화</button>
          <button type="button" class="secondaryButton" data-action="copy-result">결과 복사</button>
        </div>
      </div>

      <div id="sv-result" class="resultCard mt-5"></div>
      <div id="sv-compare" class="resultCard mt-4"></div>
    `;

    bindMoneyInputs();

    if (!eventsBound) {
      eventsBound = true;

      container.addEventListener("click", (e) => {
        const modeBtn = e.target.closest("[data-mode]");
        if (modeBtn) {
          state.mode = modeBtn.dataset.mode;
          mount(); // 탭 전환만 전체 재구성
          return;
        }
      });

      container.addEventListener("input", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id === "sv-rate") {
          state.annualRate = Math.max(0, Number(t.value) || 0);
          updateResults();
        } else if (t.id === "sv-period") {
          state.periodValue = Math.max(1, Number(t.value) || 1);
          updateResults();
        }
      });

      container.addEventListener("change", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id === "sv-unit") {
          state.periodUnit = t.value;
          updateResults();
        } else if (t.id === "sv-tax") {
          state.taxType = t.value;
          updateResults();
        }
      });

      wireCopyAndReset(
        container,
        () => {
          const r = lastResult || compute();
          const c = lastCmp || compareTaxFree(r);
          return getResultText(r, c);
        },
        () => {
          state = {
            mode: "deposit",
            amount: 10_000_000,
            monthly: 300_000,
            periodValue: 12,
            periodUnit: "month",
            annualRate: 3.5,
            taxType: "normal",
          };
          mount();
        },
      );
    }

    updateResults();
  }

  mount();
}
