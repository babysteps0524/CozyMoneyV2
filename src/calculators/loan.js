import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "../utils/format.js";
import { wireCopyAndReset, bindCurrencyInput } from "./shared.js";
import { LOAN_DEFAULTS } from "../config/financialRates.js";

const QUICK_AMOUNTS = [
  1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000,
];

function calcEqualPayment(P, monthlyRate, n) {
  if (n <= 0) return { payment: 0, schedule: [] };
  if (monthlyRate === 0) {
    const payment = P / n;
    const schedule = [];
    let remain = P;
    for (let i = 1; i <= n; i++) {
      const principal = payment;
      remain = Math.max(0, remain - principal);
      schedule.push({ i, payment, principal, interest: 0, remain });
    }
    return { payment, schedule };
  }
  const payment =
    (P * monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1);
  const schedule = [];
  let remain = P;
  for (let i = 1; i <= n; i++) {
    const interest = remain * monthlyRate;
    const principal = payment - interest;
    remain = Math.max(0, remain - principal);
    schedule.push({ i, payment, principal, interest, remain });
  }
  return { payment, schedule };
}

function calcEqualPrincipal(P, monthlyRate, n) {
  const principalPart = P / n;
  const schedule = [];
  let remain = P;
  let firstPayment = 0;
  for (let i = 1; i <= n; i++) {
    const interest = remain * monthlyRate;
    const payment = principalPart + interest;
    if (i === 1) firstPayment = payment;
    remain = Math.max(0, remain - principalPart);
    schedule.push({
      i,
      payment,
      principal: principalPart,
      interest,
      remain,
    });
  }
  return { payment: firstPayment, schedule };
}

function calcBullet(P, monthlyRate, n) {
  const interestOnly = P * monthlyRate;
  const schedule = [];
  for (let i = 1; i <= n; i++) {
    const isLast = i === n;
    const principal = isLast ? P : 0;
    const payment = interestOnly + principal;
    schedule.push({
      i,
      payment,
      principal,
      interest: interestOnly,
      remain: isLast ? 0 : P,
    });
  }
  return { payment: interestOnly, schedule };
}

export function computeLoan({
  amount,
  periodMonths,
  annualRate,
  graceMonths = 0,
  type = "equalPayment",
}) {
  const P = Math.max(0, amount);
  const n = Math.max(0, Math.floor(periodMonths));
  const g = Math.min(Math.max(0, Math.floor(graceMonths)), n);
  const monthlyRate = annualRate / 100 / 12;
  const repayMonths = Math.max(0, n - g);

  const schedule = [];
  let firstPayment = 0;

  for (let i = 1; i <= g; i++) {
    const interest = P * monthlyRate;
    schedule.push({
      i,
      payment: interest,
      principal: 0,
      interest,
      remain: P,
    });
  }

  if (repayMonths > 0) {
    let result;
    if (type === "equalPrincipal") {
      result = calcEqualPrincipal(P, monthlyRate, repayMonths);
    } else if (type === "bullet") {
      result = calcBullet(P, monthlyRate, repayMonths);
    } else {
      result = calcEqualPayment(P, monthlyRate, repayMonths);
    }
    firstPayment = result.payment;
    result.schedule.forEach((row, idx) => {
      schedule.push({ ...row, i: g + idx + 1 });
    });
  }

  if (schedule.length) {
    firstPayment = schedule[0].payment;
  }

  const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);
  const totalInterest = totalPayment - P;

  return {
    principal: P,
    totalPayment,
    totalInterest,
    firstPayment,
    schedule,
    months: n,
  };
}

export function renderLoanCalculator(container) {
  let state = {
    amount: LOAN_DEFAULTS.amount,
    periodValue: 30,
    periodUnit: "year",
    annualRate: LOAN_DEFAULTS.annualRate,
    graceMonths: 0,
    type: "equalPayment",
    showAll: false,
  };

  let lastResult = null;
  let eventsBound = false;

  const periodMonths = () =>
    state.periodUnit === "year"
      ? Math.round(state.periodValue * 12)
      : Math.round(state.periodValue);

  function getResultText(result) {
    return [
      `[대출 계산 결과]`,
      `대출원금: ${formatCurrency(result.principal)}`,
      `총 상환금액: ${formatCurrency(result.totalPayment)}`,
      `총 이자: ${formatCurrency(result.totalInterest)}`,
      `첫 회차 상환금: ${formatCurrency(result.firstPayment)}`,
      `기간: ${result.months}개월`,
      `연이율: ${formatPercent(state.annualRate)}`,
      `상환방식: ${
        state.type === "equalPayment"
          ? "원리금균등"
          : state.type === "equalPrincipal"
            ? "원금균등"
            : "만기일시"
      }`,
    ].join("\n");
  }

  function updateResults() {
    const months = periodMonths();
    const result = computeLoan({
      amount: state.amount,
      periodMonths: months,
      annualRate: state.annualRate,
      graceMonths: state.graceMonths,
      type: state.type,
    });
    lastResult = result;

    const principalRatio =
      result.totalPayment > 0 ? result.principal / result.totalPayment : 1;
    const rows = state.showAll
      ? result.schedule
      : result.schedule.slice(0, 12);

    const resultEl = container.querySelector("#loan-result");
    if (resultEl) {
      resultEl.innerHTML = /* html */ `
        <h3 class="text-18px font-bold m-0 mb-3">계산 결과</h3>
        <dl class="grid grid-cols-2 gap-3 m-0 text-14px">
          <div>
            <dt class="text-cm-text-muted m-0">총 대출원금</dt>
            <dd class="m-0 font-bold text-16px">${formatCurrency(result.principal)}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">총 상환금액</dt>
            <dd class="m-0 font-bold text-16px">${formatCurrency(result.totalPayment)}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">총 이자</dt>
            <dd class="m-0 font-bold text-16px text-cm-accent">${formatCurrency(result.totalInterest)}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">첫 회차 상환금</dt>
            <dd class="m-0 font-bold text-16px">${formatCurrency(result.firstPayment)}</dd>
          </div>
        </dl>
        <div class="mt-3" role="img" aria-label="원금 비율 ${(principalRatio * 100).toFixed(1)}%">
          <div class="flex justify-between text-12px text-cm-text-secondary mb-1">
            <span>원금 ${formatPercent(principalRatio * 100, 1)}</span>
            <span>이자 ${formatPercent((1 - principalRatio) * 100, 1)}</span>
          </div>
          <div class="h-3 rounded-full bg-cmCard-border overflow-hidden">
            <div class="h-full bg-cm-accent" data-progress="${Math.round(principalRatio * 100)}"></div>
          </div>
        </div>
      `;
      const bar = resultEl.querySelector("[data-progress]");
      if (bar) bar.style.width = `${bar.dataset.progress}%`;
    }

    const scheduleEl = container.querySelector("#loan-schedule");
    if (scheduleEl) {
      scheduleEl.innerHTML = /* html */ `
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-16px font-bold m-0">월별 상환 스케줄</h3>
          <button type="button" class="secondaryButton text-12px" data-action="toggle-schedule">
            ${state.showAll ? "접기" : "전체 보기"}
          </button>
        </div>
        <div class="overflow-x-auto border border-cm-border rounded-cm-sm">
          <table class="w-full text-13px border-collapse min-w-500px">
            <thead class="bg-cmCard">
              <tr>
                <th class="p-2 text-left border-b border-cm-border">회차</th>
                <th class="p-2 text-right border-b border-cm-border">상환금액</th>
                <th class="p-2 text-right border-b border-cm-border">원금</th>
                <th class="p-2 text-right border-b border-cm-border">이자</th>
                <th class="p-2 text-right border-b border-cm-border">남은 원금</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) => `
                <tr>
                  <td class="p-2 border-b border-cmCard-border">${r.i}</td>
                  <td class="p-2 text-right border-b border-cmCard-border">${formatNumber(Math.round(r.payment))}</td>
                  <td class="p-2 text-right border-b border-cmCard-border">${formatNumber(Math.round(r.principal))}</td>
                  <td class="p-2 text-right border-b border-cmCard-border">${formatNumber(Math.round(r.interest))}</td>
                  <td class="p-2 text-right border-b border-cmCard-border">${formatNumber(Math.round(r.remain))}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
        ${
          !state.showAll && result.schedule.length > 12
            ? `<p class="text-12px text-cm-text-muted mt-2 m-0">총 ${result.schedule.length}회 중 12회만 표시 중</p>`
            : ""
        }
      `;
    }
  }

  function syncFormValues() {
    const amountInput = container.querySelector("#loan-amount");
    if (amountInput && document.activeElement !== amountInput) {
      amountInput.value = formatNumber(state.amount);
    }
    const rate = container.querySelector("#loan-rate");
    if (rate && document.activeElement !== rate) {
      rate.value = String(state.annualRate);
    }
    const period = container.querySelector("#loan-period");
    if (period && document.activeElement !== period) {
      period.value = String(state.periodValue);
    }
    const unit = container.querySelector("#loan-unit");
    if (unit) unit.value = state.periodUnit;
    const grace = container.querySelector("#loan-grace");
    if (grace && document.activeElement !== grace) {
      grace.value = String(state.graceMonths);
    }
    container.querySelectorAll('input[name="loan-type"]').forEach((el) => {
      el.checked = el.value === state.type;
    });
  }

  function mount() {
    container.innerHTML = /* html */ `
      <div class="calculatorCard">
        <h2 class="text-24px font-bold text-cm-text mb-2 m-0">대출 계산기</h2>
        <p class="text-14px text-cm-text-secondary m-0 mb-5">원리금균등 · 원금균등 · 만기일시 상환 지원. 입력 변경 시 즉시 계산됩니다.</p>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-13px font-semibold text-cm-text mb-1.5" for="loan-amount">대출금액</label>
            <input id="loan-amount" type="text" inputmode="numeric" class="calculatorInput" value="${formatNumber(state.amount)}" aria-label="대출금액" />
            <div class="flex flex-wrap gap-1.5 mt-2">
              ${QUICK_AMOUNTS.map(
                (a) =>
                  `<button type="button" class="secondaryButton text-12px px-2 py-1" data-quick="${a}">${formatNumber(a / 10000)}만원</button>`,
              ).join("")}
            </div>
          </div>

          <div>
            <label class="block text-13px font-semibold text-cm-text mb-1.5" for="loan-rate">연 이율 (%)</label>
            <input id="loan-rate" type="number" step="0.01" min="0" class="calculatorInput" value="${state.annualRate}" />
          </div>

          <div>
            <label class="block text-13px font-semibold text-cm-text mb-1.5" for="loan-period">대출기간</label>
            <div class="flex gap-2">
              <input id="loan-period" type="number" min="1" class="calculatorInput flex-1" value="${state.periodValue}" />
              <select id="loan-unit" class="calculatorInput w-24">
                <option value="year" ${state.periodUnit === "year" ? "selected" : ""}>년</option>
                <option value="month" ${state.periodUnit === "month" ? "selected" : ""}>개월</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-13px font-semibold text-cm-text mb-1.5" for="loan-grace">거치기간 (개월)</label>
            <input id="loan-grace" type="number" min="0" class="calculatorInput" value="${state.graceMonths}" />
          </div>

          <div class="md:col-span-2">
            <span class="block text-13px font-semibold text-cm-text mb-1.5">상환 방식</span>
            <div class="flex flex-wrap gap-2">
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="loan-type" value="equalPayment" ${state.type === "equalPayment" ? "checked" : ""} />
                원리금균등
              </label>
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="loan-type" value="equalPrincipal" ${state.type === "equalPrincipal" ? "checked" : ""} />
                원금균등
              </label>
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="loan-type" value="bullet" ${state.type === "bullet" ? "checked" : ""} />
                만기일시
              </label>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mt-5">
          <button type="button" class="secondaryButton" data-action="reset">초기화</button>
          <button type="button" class="secondaryButton" data-action="copy-result">결과 복사</button>
        </div>
      </div>

      <div id="loan-result" class="resultCard mt-5"></div>
      <div id="loan-schedule" class="mt-5"></div>
    `;

    if (!eventsBound) {
      eventsBound = true;

      // 이벤트 위임: container에 한 번만
      container.addEventListener("input", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;

        if (t.id === "loan-rate") {
          state.annualRate = Math.max(0, Number(t.value) || 0);
          updateResults();
        } else if (t.id === "loan-period") {
          state.periodValue = Math.max(1, Number(t.value) || 1);
          updateResults();
        } else if (t.id === "loan-grace") {
          state.graceMonths = Math.max(0, Number(t.value) || 0);
          updateResults();
        }
      });

      container.addEventListener("change", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;

        if (t.id === "loan-unit") {
          state.periodUnit = t.value;
          updateResults();
        } else if (t.name === "loan-type") {
          state.type = t.value;
          updateResults();
        }
      });

      container.addEventListener("click", (e) => {
        const quick = e.target.closest("[data-quick]");
        if (quick) {
          state.amount = Number(quick.dataset.quick);
          const amountInput = container.querySelector("#loan-amount");
          if (amountInput) amountInput.value = formatNumber(state.amount);
          updateResults();
          return;
        }
        if (e.target.closest('[data-action="toggle-schedule"]')) {
          state.showAll = !state.showAll;
          updateResults();
        }
      });

      wireCopyAndReset(
        container,
        () => getResultText(lastResult || computeLoan({
          amount: state.amount,
          periodMonths: periodMonths(),
          annualRate: state.annualRate,
          graceMonths: state.graceMonths,
          type: state.type,
        })),
        () => {
          state = {
            amount: LOAN_DEFAULTS.amount,
            periodValue: 30,
            periodUnit: "year",
            annualRate: LOAN_DEFAULTS.annualRate,
            graceMonths: 0,
            type: "equalPayment",
            showAll: false,
          };
          // 리셋 시에만 폼 값 동기화 + 결과 갱신 (전체 mount 불필요)
          syncFormValues();
          const amountInput = container.querySelector("#loan-amount");
          if (amountInput) amountInput.value = formatNumber(state.amount);
          updateResults();
        },
      );

      const amountInput = container.querySelector("#loan-amount");
      bindCurrencyInput(amountInput, (v) => {
        state.amount = v;
        updateResults(); // render() 금지
      });
    } else {
      // 이미 바인딩된 경우 amount만 다시 연결 (mount 재호출 시)
      const amountInput = container.querySelector("#loan-amount");
      bindCurrencyInput(amountInput, (v) => {
        state.amount = v;
        updateResults();
      });
    }

    updateResults();
  }

  mount();
}
