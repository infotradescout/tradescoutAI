export interface AmortizedLoanCalculation {
  principal: number;
  annualRatePercent: number;
  termMonths: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
}

export interface AutoLoanInput {
  vehiclePrice: number;
  downPayment: number;
  tradeInValue: number;
  annualRatePercent: number;
  termMonths: number;
}

export interface AutoLoanCalculation {
  vehiclePrice: number;
  downPayment: number;
  tradeInValue: number;
  loanAmount: number;
  monthlyPayment: number;
  totalLoanPayments: number;
  totalInterest: number;
  totalCost: number;
}

export interface CommissionInput {
  salesPrice: number;
  commissionRatePercent: number;
  agentSplitPercent: number;
}

export interface CommissionCalculation {
  grossCommission: number;
  agentCommission: number;
}

export interface AffordableHomePriceInput {
  annualIncome: number;
  monthlyDebts: number;
  downPayment: number;
  annualRatePercent: number;
  termYears: number;
  housingRatio?: number;
}

export interface AffordableHomePriceCalculation {
  monthlyIncome: number;
  maxMonthlyPayment: number;
  maxLoanAmount: number;
  maxHomePrice: number;
}

const nonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const boundedPercent = (value: number): number => Math.min(100, nonNegative(value));

export function calculateAmortizedLoan(
  principalInput: number,
  annualRatePercentInput: number,
  termMonthsInput: number
): AmortizedLoanCalculation {
  const principal = nonNegative(principalInput);
  const annualRatePercent = nonNegative(annualRatePercentInput);
  const termMonths = Number.isFinite(termMonthsInput)
    ? Math.max(0, Math.trunc(termMonthsInput))
    : 0;

  if (principal === 0 || termMonths === 0) {
    return {
      principal,
      annualRatePercent,
      termMonths,
      monthlyPayment: 0,
      totalPaid: 0,
      totalInterest: 0,
    };
  }

  const monthlyRate = annualRatePercent / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);
  const totalPaid = monthlyPayment * termMonths;

  return {
    principal,
    annualRatePercent,
    termMonths,
    monthlyPayment,
    totalPaid,
    totalInterest: Math.max(0, totalPaid - principal),
  };
}

export function calculateAutoLoan(input: AutoLoanInput): AutoLoanCalculation {
  const vehiclePrice = nonNegative(input.vehiclePrice);
  const downPayment = nonNegative(input.downPayment);
  const tradeInValue = nonNegative(input.tradeInValue);
  const upfrontValue = Math.min(vehiclePrice, downPayment + tradeInValue);
  const loanAmount = Math.max(0, vehiclePrice - upfrontValue);
  const loan = calculateAmortizedLoan(
    loanAmount,
    input.annualRatePercent,
    input.termMonths
  );

  return {
    vehiclePrice,
    downPayment,
    tradeInValue,
    loanAmount,
    monthlyPayment: loan.monthlyPayment,
    totalLoanPayments: loan.totalPaid,
    totalInterest: loan.totalInterest,
    totalCost: upfrontValue + loan.totalPaid,
  };
}

export function calculateCommission(input: CommissionInput): CommissionCalculation {
  const salesPrice = nonNegative(input.salesPrice);
  const commissionRatePercent = boundedPercent(input.commissionRatePercent);
  const agentSplitPercent = boundedPercent(input.agentSplitPercent);
  const grossCommission = salesPrice * (commissionRatePercent / 100);

  return {
    grossCommission,
    agentCommission: grossCommission * (agentSplitPercent / 100),
  };
}

export function calculateAffordableHomePrice(
  input: AffordableHomePriceInput
): AffordableHomePriceCalculation {
  const annualIncome = nonNegative(input.annualIncome);
  const monthlyDebts = nonNegative(input.monthlyDebts);
  const downPayment = nonNegative(input.downPayment);
  const annualRatePercent = nonNegative(input.annualRatePercent);
  const termMonths = Number.isFinite(input.termYears)
    ? Math.max(0, Math.trunc(input.termYears * 12))
    : 0;
  const housingRatio = Math.min(1, nonNegative(input.housingRatio ?? 0.28));
  const monthlyIncome = annualIncome / 12;
  const maxMonthlyPayment = Math.max(0, monthlyIncome * housingRatio - monthlyDebts);

  if (maxMonthlyPayment === 0 || termMonths === 0) {
    return {
      monthlyIncome,
      maxMonthlyPayment,
      maxLoanAmount: 0,
      maxHomePrice: downPayment,
    };
  }

  const monthlyRate = annualRatePercent / 100 / 12;
  const maxLoanAmount =
    monthlyRate === 0
      ? maxMonthlyPayment * termMonths
      : (maxMonthlyPayment * (Math.pow(1 + monthlyRate, termMonths) - 1)) /
        (monthlyRate * Math.pow(1 + monthlyRate, termMonths));

  return {
    monthlyIncome,
    maxMonthlyPayment,
    maxLoanAmount,
    maxHomePrice: maxLoanAmount + downPayment,
  };
}
