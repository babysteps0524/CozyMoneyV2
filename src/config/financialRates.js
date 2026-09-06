export const FINANCIAL_RATES = {
  nationalPension: 0.045,
  healthInsurance: 0.03545,
  longTermCareMultiplier: 0.1295,
  employmentInsurance: 0.009,
  incomeTaxEstimate: 0.033, // approximate effective for mid range; UI notes limitation
  localTaxRate: 0.1,
};

export const SAVINGS_TAX_RATES = {
  normal: 0.154,
  taxFree: 0,
  preferential: 0.014,
};

export const LOAN_DEFAULTS = {
  amount: 100000000,
  periodMonths: 360,
  annualRate: 3.5,
  graceMonths: 0,
  type: "equalPayment", // equalPayment | equalPrincipal | bullet
};
