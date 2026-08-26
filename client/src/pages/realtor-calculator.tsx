import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, DollarSign, Percent, Home, TrendingUp, PiggyBank } from "lucide-react";
import {
  calculateAffordableHomePrice,
  calculateAmortizedLoan,
  calculateCommission,
} from "@/lib/financialCalculators";

export default function RealtorCalculator() {
  // Mortgage Calculator State
  const [homePrice, setHomePrice] = useState(400000);
  const [downPayment, setDownPayment] = useState([20]);
  const [interestRate, setInterestRate] = useState([6.5]);
  const [loanTerm, setLoanTerm] = useState([30]);

  // Commission Calculator State
  const [salesPrice, setSalesPrice] = useState(500000);
  const [commissionRate, setCommissionRate] = useState([6]);
  const [splitPercentage, setSplitPercentage] = useState([50]);

  // Affordability Calculator State  
  const [annualIncome, setAnnualIncome] = useState(80000);
  const [monthlyDebts, setMonthlyDebts] = useState(500);
  const [downPaymentAmount, setDownPaymentAmount] = useState(40000);

  const mortgage = calculateAmortizedLoan(
    homePrice - (homePrice * downPayment[0]) / 100,
    interestRate[0],
    loanTerm[0] * 12
  );
  const loanAmount = mortgage.principal;
  const monthlyPayment = mortgage.monthlyPayment;

  const commission = calculateCommission({
    salesPrice,
    commissionRatePercent: commissionRate[0],
    agentSplitPercent: splitPercentage[0],
  });
  const { grossCommission, agentCommission } = commission;

  const affordability = calculateAffordableHomePrice({
    annualIncome,
    monthlyDebts,
    downPayment: downPaymentAmount,
    annualRatePercent: interestRate[0],
    termYears: loanTerm[0],
  });
  const { maxMonthlyPayment, maxLoanAmount, maxHomePrice } = affordability;

  return (
    <div className="text-foreground">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Real Estate Calculators</h1>
              <p className="text-muted-foreground">Tools to help your clients make informed decisions</p>
            </div>
          </div>

          <Tabs defaultValue="mortgage" className="space-y-6">
            <TabsList className="bg-muted border border-border">
              <TabsTrigger value="mortgage">Mortgage Calculator</TabsTrigger>
              <TabsTrigger value="commission">Commission Calculator</TabsTrigger>
              <TabsTrigger value="affordability">Affordability Calculator</TabsTrigger>
            </TabsList>

            <TabsContent value="mortgage" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mortgage Calculator Input */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-primary" />
                    Mortgage Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="homePrice" className="text-foreground">Home Price ($)</Label>
                    <Input
                      id="homePrice"
                      type="number"
                      value={homePrice}
                      onChange={(e) => setHomePrice(Number(e.target.value))}
                      className="bg-background border-input text-lg text-foreground"
                      data-testid="input-home-price"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Down Payment: {downPayment[0]}% (${(homePrice * downPayment[0] / 100).toLocaleString()})</Label>
                    <Slider
                      value={downPayment}
                      onValueChange={setDownPayment}
                      max={30}
                      min={0}
                      step={1}
                      className="mt-3"
                      data-testid="slider-down-payment"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Interest Rate: {interestRate[0]}%</Label>
                    <Slider
                      value={interestRate}
                      onValueChange={setInterestRate}
                      max={10}
                      min={3}
                      step={0.1}
                      className="mt-3"
                      data-testid="slider-interest-rate"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Loan Term: {loanTerm[0]} years</Label>
                    <Slider
                      value={loanTerm}
                      onValueChange={setLoanTerm}
                      max={30}
                      min={10}
                      step={5}
                      className="mt-3"
                      data-testid="slider-loan-term"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Mortgage Results */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    Payment Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-primary/10 rounded-lg mb-6">
                    <p className="text-sm text-muted-foreground mb-2">Monthly Payment</p>
                    <p className="text-4xl font-bold text-primary">${monthlyPayment.toFixed(2)}</p>
                  </div>

                  <div className="space-y-4 text-foreground">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Home Price</span>
                      <span>${homePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Down Payment ({downPayment[0]}%)</span>
                      <span className="text-green-500">${(homePrice * downPayment[0] / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="text-muted-foreground">Loan Amount</span>
                      <span>${loanAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="mt-6 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                    Principal and interest estimate only. Taxes, insurance, fees, and lender terms
                    are not included.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commission" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Commission Calculator Input */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-green-500" />
                    Commission Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="salesPrice" className="text-foreground">Sales Price ($)</Label>
                    <Input
                      id="salesPrice"
                      type="number"
                      value={salesPrice}
                      onChange={(e) => setSalesPrice(Number(e.target.value))}
                      className="bg-background border-input text-lg text-foreground"
                      data-testid="input-sales-price"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Total Commission Rate: {commissionRate[0]}%</Label>
                    <Slider
                      value={commissionRate}
                      onValueChange={setCommissionRate}
                      max={10}
                      min={4}
                      step={0.25}
                      className="mt-3"
                      data-testid="slider-commission-rate"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Your Split: {splitPercentage[0]}%</Label>
                    <Slider
                      value={splitPercentage}
                      onValueChange={setSplitPercentage}
                      max={100}
                      min={30}
                      step={5}
                      className="mt-3"
                      data-testid="slider-split-percentage"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Commission Results */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Commission Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-green-500/10 rounded-lg mb-6">
                    <p className="text-sm text-muted-foreground mb-2">Your Commission</p>
                    <p className="text-4xl font-bold text-green-500">${agentCommission.toLocaleString()}</p>
                  </div>

                  <div className="space-y-4 text-foreground">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sales Price</span>
                      <span>${salesPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Commission ({commissionRate[0]}%)</span>
                      <span>${grossCommission.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="text-muted-foreground">Your Share ({splitPercentage[0]}%)</span>
                      <span className="text-green-500">${agentCommission.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="affordability" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Affordability Input */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-ts-orange" />
                    Financial Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="annualIncome" className="text-foreground">Annual Income ($)</Label>
                    <Input
                      id="annualIncome"
                      type="number"
                      value={annualIncome}
                      onChange={(e) => setAnnualIncome(Number(e.target.value))}
                      className="bg-background border-input text-foreground"
                      data-testid="input-annual-income"
                    />
                  </div>

                  <div>
                    <Label htmlFor="monthlyDebts" className="text-foreground">Monthly Debts ($)</Label>
                    <Input
                      id="monthlyDebts"
                      type="number"
                      value={monthlyDebts}
                      onChange={(e) => setMonthlyDebts(Number(e.target.value))}
                      className="bg-background border-input text-foreground"
                      data-testid="input-monthly-debts"
                    />
                  </div>

                  <div>
                    <Label htmlFor="downPaymentAmount" className="text-foreground">Available Down Payment ($)</Label>
                    <Input
                      id="downPaymentAmount"
                      type="number"
                      value={downPaymentAmount}
                      onChange={(e) => setDownPaymentAmount(Number(e.target.value))}
                      className="bg-background border-input text-foreground"
                      data-testid="input-down-payment-amount"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Affordability Results */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-ts-orange" />
                    Home Affordability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-ts-orange/10 rounded-lg mb-6">
                    <p className="text-sm text-muted-foreground mb-2">Maximum Home Price</p>
                    <p className="text-4xl font-bold text-ts-orange">${maxHomePrice.toLocaleString()}</p>
                  </div>

                  <div className="space-y-4 text-foreground">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Income</span>
                      <span>${(annualIncome / 12).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Housing Payment</span>
                      <span className="text-ts-orange">${maxMonthlyPayment.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Loan Amount</span>
                      <span>${maxLoanAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="text-green-500">${downPaymentAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-primary/10 rounded-lg text-center">
                    <p className="text-sm text-primary">
                      Based on 28% debt-to-income ratio
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}