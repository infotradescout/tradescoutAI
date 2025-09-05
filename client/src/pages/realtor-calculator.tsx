import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  Home,
  TrendingUp,
  FileText,
  PiggyBank
} from "lucide-react";

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

  // Calculate mortgage payment
  const loanAmount = homePrice - (homePrice * downPayment[0] / 100);
  const monthlyRate = interestRate[0] / 100 / 12;
  const numPayments = loanTerm[0] * 12;
  const monthlyPayment = loanAmount > 0 && monthlyRate > 0 
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : 0;

  // Calculate commission
  const grossCommission = salesPrice * (commissionRate[0] / 100);
  const agentCommission = grossCommission * (splitPercentage[0] / 100);

  // Calculate affordability
  const maxMonthlyPayment = (annualIncome / 12) * 0.28 - monthlyDebts;
  const maxLoanAmount = maxMonthlyPayment > 0 
    ? (maxMonthlyPayment * (Math.pow(1 + monthlyRate, numPayments) - 1)) / (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
    : 0;
  const maxHomePrice = maxLoanAmount + downPaymentAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Calculator className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Real Estate Calculators</h1>
              <p className="text-gray-400">Tools to help your clients make informed decisions</p>
            </div>
          </div>

          <Tabs defaultValue="mortgage" className="space-y-6">
            <TabsList className="bg-navy-800/50 border border-navy-600">
              <TabsTrigger value="mortgage">Mortgage Calculator</TabsTrigger>
              <TabsTrigger value="commission">Commission Calculator</TabsTrigger>
              <TabsTrigger value="affordability">Affordability Calculator</TabsTrigger>
            </TabsList>

            <TabsContent value="mortgage" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mortgage Calculator Input */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-blue-400" />
                    Mortgage Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="homePrice">Home Price ($)</Label>
                    <Input
                      id="homePrice"
                      type="number"
                      value={homePrice}
                      onChange={(e) => setHomePrice(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600 text-lg"
                      data-testid="input-home-price"
                    />
                  </div>

                  <div>
                    <Label>Down Payment: {downPayment[0]}% (${(homePrice * downPayment[0] / 100).toLocaleString()})</Label>
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
                    <Label>Interest Rate: {interestRate[0]}%</Label>
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
                    <Label>Loan Term: {loanTerm[0]} years</Label>
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
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    Payment Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-blue-500/10 rounded-lg mb-6">
                    <p className="text-sm text-gray-400 mb-2">Monthly Payment</p>
                    <p className="text-4xl font-bold text-blue-400">${monthlyPayment.toFixed(2)}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Home Price</span>
                      <span>${homePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Down Payment ({downPayment[0]}%)</span>
                      <span className="text-green-400">${(homePrice * downPayment[0] / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-navy-700 pt-3">
                      <span className="text-gray-400">Loan Amount</span>
                      <span>${loanAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700" data-testid="button-generate-amortization">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Amortization Schedule
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commission" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Commission Calculator Input */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-green-400" />
                    Commission Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="salesPrice">Sales Price ($)</Label>
                    <Input
                      id="salesPrice"
                      type="number"
                      value={salesPrice}
                      onChange={(e) => setSalesPrice(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600 text-lg"
                      data-testid="input-sales-price"
                    />
                  </div>

                  <div>
                    <Label>Total Commission Rate: {commissionRate[0]}%</Label>
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
                    <Label>Your Split: {splitPercentage[0]}%</Label>
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
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Commission Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-green-500/10 rounded-lg mb-6">
                    <p className="text-sm text-gray-400 mb-2">Your Commission</p>
                    <p className="text-4xl font-bold text-green-400">${agentCommission.toLocaleString()}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sales Price</span>
                      <span>${salesPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Commission ({commissionRate[0]}%)</span>
                      <span>${grossCommission.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-navy-700 pt-3">
                      <span className="text-gray-400">Your Share ({splitPercentage[0]}%)</span>
                      <span className="text-green-400">${agentCommission.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="affordability" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Affordability Input */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-orange-400" />
                    Financial Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="annualIncome">Annual Income ($)</Label>
                    <Input
                      id="annualIncome"
                      type="number"
                      value={annualIncome}
                      onChange={(e) => setAnnualIncome(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600"
                      data-testid="input-annual-income"
                    />
                  </div>

                  <div>
                    <Label htmlFor="monthlyDebts">Monthly Debts ($)</Label>
                    <Input
                      id="monthlyDebts"
                      type="number"
                      value={monthlyDebts}
                      onChange={(e) => setMonthlyDebts(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600"
                      data-testid="input-monthly-debts"
                    />
                  </div>

                  <div>
                    <Label htmlFor="downPaymentAmount">Available Down Payment ($)</Label>
                    <Input
                      id="downPaymentAmount"
                      type="number"
                      value={downPaymentAmount}
                      onChange={(e) => setDownPaymentAmount(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600"
                      data-testid="input-down-payment-amount"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Affordability Results */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-orange-400" />
                    Home Affordability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-orange-500/10 rounded-lg mb-6">
                    <p className="text-sm text-gray-400 mb-2">Maximum Home Price</p>
                    <p className="text-4xl font-bold text-orange-400">${maxHomePrice.toLocaleString()}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monthly Income</span>
                      <span>${(annualIncome / 12).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Housing Payment</span>
                      <span className="text-orange-400">${maxMonthlyPayment.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Loan Amount</span>
                      <span>${maxLoanAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-navy-700 pt-3">
                      <span className="text-gray-400">Down Payment</span>
                      <span className="text-green-400">${downPaymentAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-center">
                    <p className="text-sm text-blue-400">
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