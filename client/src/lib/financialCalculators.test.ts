import { describe, expect, it } from "vitest";
import {
  calculateAffordableHomePrice,
  calculateAmortizedLoan,
  calculateAutoLoan,
  calculateCommission,
} from "./financialCalculators";

describe("financial calculators", () => {
  it("calculates a standard amortized monthly payment", () => {
    const result = calculateAmortizedLoan(25_000, 4.5, 60);

    expect(result.monthlyPayment).toBeCloseTo(466.08, 2);
    expect(result.totalPaid).toBeGreaterThan(25_000);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - 25_000, 8);
  });

  it("handles zero-interest loans instead of returning a zero payment", () => {
    const result = calculateAmortizedLoan(12_000, 0, 12);

    expect(result.monthlyPayment).toBe(1_000);
    expect(result.totalPaid).toBe(12_000);
    expect(result.totalInterest).toBe(0);
  });

  it("calculates an auto loan from price, cash, and trade value", () => {
    const result = calculateAutoLoan({
      vehiclePrice: 25_000,
      downPayment: 5_000,
      tradeInValue: 2_000,
      annualRatePercent: 4.5,
      termMonths: 60,
    });

    expect(result.loanAmount).toBe(18_000);
    expect(result.monthlyPayment).toBeCloseTo(335.57, 2);
    expect(result.totalCost).toBeCloseTo(25_000 + result.totalInterest, 8);
  });

  it("calculates gross and agent commission", () => {
    expect(
      calculateCommission({
        salesPrice: 500_000,
        commissionRatePercent: 6,
        agentSplitPercent: 50,
      })
    ).toEqual({
      grossCommission: 30_000,
      agentCommission: 15_000,
    });
  });

  it("calculates affordability from income, debt, loan terms, and cash", () => {
    const result = calculateAffordableHomePrice({
      annualIncome: 80_000,
      monthlyDebts: 500,
      downPayment: 40_000,
      annualRatePercent: 6.5,
      termYears: 30,
    });

    expect(result.monthlyIncome).toBeCloseTo(6_666.67, 2);
    expect(result.maxMonthlyPayment).toBeCloseTo(1_366.67, 2);
    expect(result.maxLoanAmount).toBeGreaterThan(0);
    expect(result.maxHomePrice).toBeCloseTo(result.maxLoanAmount + 40_000, 8);
  });

  it("fails closed for invalid and unaffordable inputs", () => {
    expect(calculateAmortizedLoan(Number.NaN, -2, 60).monthlyPayment).toBe(0);

    const result = calculateAffordableHomePrice({
      annualIncome: 12_000,
      monthlyDebts: 2_000,
      downPayment: 5_000,
      annualRatePercent: 6,
      termYears: 30,
    });

    expect(result.maxMonthlyPayment).toBe(0);
    expect(result.maxLoanAmount).toBe(0);
    expect(result.maxHomePrice).toBe(5_000);
  });
});
