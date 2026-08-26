import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, CreditCard, TrendingUp } from "lucide-react";
import { calculateAmortizedLoan } from "@/lib/financialCalculators";

const formatCurrency = (value: number): string =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function CarSalesFinancing() {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("4.5");
  const [loanTerm, setLoanTerm] = useState("60");

  const calculation = calculateAmortizedLoan(
    Number(loanAmount),
    Number(interestRate),
    Number(loanTerm)
  );

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 text-white">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-green-500/20 p-3">
              <CreditCard className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Auto Loan Calculator</h1>
              <p className="text-white/60">
                Estimate a monthly vehicle payment from the amount financed and loan terms.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-white/10 bg-tsCard/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-green-400" />
                  Loan details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="loanAmount">Loan Amount ($)</Label>
                  <Input
                    id="loanAmount"
                    type="number"
                    min="0"
                    value={loanAmount}
                    onChange={(event) => setLoanAmount(event.target.value)}
                    placeholder="25000"
                    className="border-white/10 bg-tsCard/50"
                    data-testid="input-loan-amount"
                  />
                </div>

                <div>
                  <Label htmlFor="interestRate">Annual Interest Rate (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    min="0"
                    step="0.1"
                    value={interestRate}
                    onChange={(event) => setInterestRate(event.target.value)}
                    className="border-white/10 bg-tsCard/50"
                    data-testid="input-interest-rate"
                  />
                </div>

                <div>
                  <Label htmlFor="loanTerm">Loan Term (months)</Label>
                  <Input
                    id="loanTerm"
                    type="number"
                    min="1"
                    step="1"
                    value={loanTerm}
                    onChange={(event) => setLoanTerm(event.target.value)}
                    className="border-white/10 bg-tsCard/50"
                    data-testid="input-loan-term"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-tsCard/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  Payment estimate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-green-500/10 p-6 text-center">
                  <p className="mb-2 text-sm text-white/60">Monthly Payment</p>
                  <p className="text-3xl font-bold text-green-400">
                    ${formatCurrency(calculation.monthlyPayment)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/60">Principal</span>
                    <span>${formatCurrency(calculation.principal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Interest Rate</span>
                    <span>{calculation.annualRatePercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Term</span>
                    <span>{calculation.termMonths} months</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-3">
                    <span className="text-white/60">Total Interest</span>
                    <span>${formatCurrency(calculation.totalInterest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Total Loan Payments</span>
                    <span>${formatCurrency(calculation.totalPaid)}</span>
                  </div>
                </div>

                <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-white/60">
                  This is an estimate, not a lender offer or approval. Taxes, fees, insurance, and
                  lender-specific terms are not included.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
