import { formatCurrency, formatNumber } from "../utils/format.js";
import { FINANCIAL_RATES } from "../config/financialRates.js";
import { wireCopyAndReset, bindCurrencyInput } from "./shared.js";

function estimateMonthlyDeductions(monthlyGross, nonTaxable = 200000) {
  const taxableBase = Math.max(0, monthlyGross - nonTaxable);
  const np = monthlyGross * FINANCIAL_RATES.nationalPension;
  const hi = monthlyGross * FINANCIAL_RATES.healthInsurance;
  const ltc = hi * FINANCIAL_RATES.longTermCareMultiplier;
  const ei = monthlyGross * FINANCIAL_RATES.employmentInsurance;
  const incomeTax = taxableBase * FINANCIAL_RATES.incomeTaxEstimate;
  const localTax = incomeTax * FINANCIAL_RATES.localTaxRate;
  const totalDeduct = np + hi + ltc + ei + incomeTax + localTax;
  return {
    nationalPension: np,
    healthInsurance: hi,
    longTermCare: ltc,
    employmentInsurance: ei,
    incomeTax,
    localTax,
    totalDeduct,
    net: monthlyGross - totalDeduct,
  };
}

export function renderSalaryCalculator(container) {
  let state = {
    direction: "annualToMonthly",
    baseAmount: 40_000_000,
    weeklyHours: 40,
    includeWeeklyHoliday: true,
    nonTaxable: 200_000,
  };

  let lastResult = null;
  let eventsBound = false;

  function compute() {
    const hoursPerMonth = (state.weeklyHours * 52) / 12;
    let annual = 0;
    let monthly = 0;
    let hourly = 0;

    switch (state.direction) {
      case "annualToMonthly":
      case "annualToHourly":
        annual = state.baseAmount;
        monthly = annual / 12;
        hourly = monthly / hoursPerMonth;
        break;
      case "monthlyToAnnual":
        monthly = state.baseAmount;
        annual = monthly * 12;
        hourly = monthly / hoursPerMonth;
        break;
      case "hourlyToMonthly":
      case "hourlyToAnnual": {
        hourly = state.baseAmount;
        const weeklyPay = state.includeWeeklyHoliday
          ? hourly * (state.weeklyHours + state.weeklyHours / 5)
          : hourly * state.weeklyHours;
        monthly = (weeklyPay * 52) / 12;
        annual = monthly * 12;
        break;
      }
      default:
        annual = state.baseAmount;
        monthly = annual / 12;
        hourly = monthly / hoursPerMonth;
    }

    const deduct = estimateMonthlyDeductions(monthly, state.nonTaxable);
    return {
      annual,
      monthly,
      hourly,
      monthlyNet: deduct.net,
      annualNet: deduct.net * 12,
      deduct,
    };
  }

  function getResultText(r) {
    return [
      `[연봉/시급 계산 결과]`,
      `월 총급여: ${formatCurrency(Math.round(r.monthly))}`,
      `월 실수령액(추정): ${formatCurrency(Math.round(r.monthlyNet))}`,
      `연 실수령액(추정): ${formatCurrency(Math.round(r.annualNet))}`,
      `시급: ${formatCurrency(Math.round(r.hourly))}`,
      `※ 근로소득세는 간이세액표 완전 구현이 아니며 추정치입니다.`,
    ].join("\n");
  }

  function updateResults() {
    const r = compute();
    lastResult = r;

    const resultEl = container.querySelector("#sal-result");
    if (resultEl) {
      resultEl.innerHTML = /* html */ `
        <h3 class="text-18px font-bold m-0 mb-3">예상 결과</h3>
        <dl class="grid grid-cols-2 gap-3 m-0 text-14px">
          <div>
            <dt class="text-cm-text-muted m-0">월 총급여</dt>
            <dd class="m-0 font-bold text-16px">${formatCurrency(Math.round(r.monthly))}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">월 실수령액(추정)</dt>
            <dd class="m-0 font-bold text-16px text-cm-accent">${formatCurrency(Math.round(r.monthlyNet))}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">연 실수령액(추정)</dt>
            <dd class="m-0 font-bold">${formatCurrency(Math.round(r.annualNet))}</dd>
          </div>
          <div>
            <dt class="text-cm-text-muted m-0">시급</dt>
            <dd class="m-0 font-bold">${formatCurrency(Math.round(r.hourly))}</dd>
          </div>
        </dl>
      `;
    }

    const deductEl = container.querySelector("#sal-deduct");
    if (deductEl) {
      deductEl.innerHTML = /* html */ `
        <h3 class="text-16px font-bold m-0 mb-2">공제 항목 (월 추정)</h3>
        <ul class="m-0 p-0 list-none text-13px space-y-1">
          <li class="flex justify-between"><span>국민연금</span><span>${formatCurrency(Math.round(r.deduct.nationalPension))}</span></li>
          <li class="flex justify-between"><span>건강보험</span><span>${formatCurrency(Math.round(r.deduct.healthInsurance))}</span></li>
          <li class="flex justify-between"><span>장기요양</span><span>${formatCurrency(Math.round(r.deduct.longTermCare))}</span></li>
          <li class="flex justify-between"><span>고용보험</span><span>${formatCurrency(Math.round(r.deduct.employmentInsurance))}</span></li>
          <li class="flex justify-between"><span>근로소득세(추정)</span><span>${formatCurrency(Math.round(r.deduct.incomeTax))}</span></li>
          <li class="flex justify-between"><span>지방소득세</span><span>${formatCurrency(Math.round(r.deduct.localTax))}</span></li>
          <li class="flex justify-between font-bold border-t border-cm-border pt-1 mt-1"><span>합계</span><span>${formatCurrency(Math.round(r.deduct.totalDeduct))}</span></li>
        </ul>
      `;
    }
  }

  function mount() {
    container.innerHTML = /* html */ `
      <div class="calculatorCard">
        <h2 class="text-24px font-bold text-cm-text mb-2 m-0">연봉 / 시급 계산기</h2>
        <p class="text-14px text-cm-text-secondary m-0 mb-4">
          4대보험·세금 요율은 financialRates.js에서 관리합니다.
          근로소득세는 간이세액표 전체가 아닌 추정 요율을 사용합니다. 실제와 다를 수 있습니다.
        </p>

        <div class="mb-4">
          <label class="block text-13px font-semibold mb-1.5" for="sal-dir">계산 방향</label>
          <select id="sal-dir" class="calculatorInput">
            <option value="annualToMonthly" ${state.direction === "annualToMonthly" ? "selected" : ""}>연봉 → 월급</option>
            <option value="annualToHourly" ${state.direction === "annualToHourly" ? "selected" : ""}>연봉 → 시급</option>
            <option value="monthlyToAnnual" ${state.direction === "monthlyToAnnual" ? "selected" : ""}>월급 → 연봉</option>
            <option value="hourlyToMonthly" ${state.direction === "hourlyToMonthly" ? "selected" : ""}>시급 → 월급</option>
            <option value="hourlyToAnnual" ${state.direction === "hourlyToAnnual" ? "selected" : ""}>시급 → 연봉</option>
          </select>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-13px font-semibold mb-1.5" for="sal-base">기준 금액</label>
            <input id="sal-base" type="text" inputmode="numeric" class="calculatorInput" value="${formatNumber(state.baseAmount)}" />
          </div>
          <div>
            <label class="block text-13px font-semibold mb-1.5" for="sal-hours">주당 근무시간</label>
            <input id="sal-hours" type="number" min="1" max="80" class="calculatorInput" value="${state.weeklyHours}" />
          </div>
          <div>
            <label class="block text-13px font-semibold mb-1.5" for="sal-nontax">비과세 금액 (월)</label>
            <input id="sal-nontax" type="text" inputmode="numeric" class="calculatorInput" value="${formatNumber(state.nonTaxable)}" />
          </div>
          <div class="flex items-end">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="sal-holiday" ${state.includeWeeklyHoliday ? "checked" : ""} />
              주휴수당 포함
            </label>
          </div>
        </div>

        <div class="flex gap-2 mt-5">
          <button type="button" class="secondaryButton" data-action="reset">초기화</button>
          <button type="button" class="secondaryButton" data-action="copy-result">결과 복사</button>
        </div>
      </div>

      <div id="sal-result" class="resultCard mt-5"></div>
      <div id="sal-deduct" class="resultCard mt-4"></div>
    `;

    for (const [id, key] of [["sal-base", "baseAmount"], ["sal-nontax", "nonTaxable"]]) {
      const el = container.querySelector("#" + id);
      if (!el) continue;
      const fresh = el.cloneNode(true);
      el.replaceWith(fresh);
      bindCurrencyInput(fresh, (v) => {
        state[key] = v;
        updateResults();
      });
    }

    if (!eventsBound) {
      eventsBound = true;

      container.addEventListener("input", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id === "sal-hours") {
          state.weeklyHours = Math.max(1, Number(t.value) || 40);
          updateResults();
        }
      });

      container.addEventListener("change", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.id === "sal-dir") {
          state.direction = t.value;
          updateResults();
        } else if (t.id === "sal-holiday") {
          state.includeWeeklyHoliday = t.checked;
          updateResults();
        }
      });

      wireCopyAndReset(
        container,
        () => getResultText(lastResult || compute()),
        () => {
          state = {
            direction: "annualToMonthly",
            baseAmount: 40_000_000,
            weeklyHours: 40,
            includeWeeklyHoliday: true,
            nonTaxable: 200_000,
          };
          mount();
        },
      );
    }

    updateResults();
  }

  mount();
}
