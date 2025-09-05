import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  Calendar,
  TrendingDown,
  TrendingUp,
  FileText
} from "lucide-react";

export default function CarSalesPaymentCalculator() {
  const [vehiclePrice, setVehiclePrice] = useState(25000);
  const [downPayment, setDownPayment] = useState(5000);
  const [interestRate, setInterestRate] = useState([4.5]);
  const [loanTerm, setLoanTerm] = useState([60]);
  const [tradeValue, setTradeValue] = useState(0);
  
  const loanAmount = vehiclePrice - downPayment - tradeValue;
  const monthlyRate = interestRate[0] / 100 / 12;
  const numPayments = loanTerm[0];
  
  const monthlyPayment = loanAmount > 0 && monthlyRate > 0 
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : 0;
  
  const totalPaid = monthlyPayment * numPayments + downPayment + tradeValue;
  const totalInterest = totalPaid - vehiclePrice;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Calculator className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Payment Calculator</h1>
              <p className="text-gray-400">Calculate monthly payments and financing options</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Calculator Inputs */}
            <div className="space-y-6">
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                    Vehicle Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="vehiclePrice">Vehicle Price ($)</Label>
                    <Input
                      id="vehiclePrice"
                      type="number"
                      value={vehiclePrice}
                      onChange={(e) => setVehiclePrice(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600 text-lg"
                      data-testid="input-vehicle-price"
                    />
                  </div>

                  <div>
                    <Label htmlFor="downPayment">Down Payment ($)</Label>
                    <Input
                      id="downPayment"
                      type="number"
                      value={downPayment}
                      onChange={(e) => setDownPayment(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600"
                      data-testid="input-down-payment"
                    />
                    <div className="text-sm text-gray-400 mt-1">
                      {((downPayment / vehiclePrice) * 100).toFixed(1)}% of vehicle price
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="tradeValue">Trade-In Value ($)</Label>
                    <Input
                      id="tradeValue"
                      type="number"
                      value={tradeValue}
                      onChange={(e) => setTradeValue(Number(e.target.value))}
                      className="bg-navy-700/50 border-navy-600"
                      data-testid="input-trade-value"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-green-400" />
                    Loan Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Interest Rate: {interestRate[0]}%</Label>
                    <Slider
                      value={interestRate}
                      onValueChange={setInterestRate}
                      max={15}
                      min={0.5}
                      step={0.1}
                      className="mt-3"
                      data-testid="slider-interest-rate"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0.5%</span>
                      <span>15%</span>
                    </div>
                  </div>

                  <div>
                    <Label>Loan Term: {loanTerm[0]} months ({(loanTerm[0] / 12).toFixed(1)} years)</Label>
                    <Slider
                      value={loanTerm}
                      onValueChange={setLoanTerm}
                      max={84}
                      min={12}
                      step={12}
                      className="mt-3"
                      data-testid="slider-loan-term"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>12 months</span>
                      <span>84 months</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Results */}
            <div className="space-y-6">
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-orange-400" />
                    Payment Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg mb-6">
                    <p className="text-sm text-gray-400 mb-2">Monthly Payment</p>
                    <p className="text-4xl font-bold text-blue-400">${monthlyPayment.toFixed(2)}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Vehicle Price</span>
                      <span className="font-medium">${vehiclePrice.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Down Payment</span>
                      <span className="font-medium text-green-400">-${downPayment.toLocaleString()}</span>
                    </div>
                    
                    {tradeValue > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Trade-In Value</span>
                        <span className="font-medium text-green-400">-${tradeValue.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center border-t border-navy-700 pt-3">
                      <span className="text-gray-400">Loan Amount</span>
                      <span className="font-semibold">${loanAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-red-400" />
                    Total Cost Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total of Payments</span>
                    <span className="font-medium">${totalPaid.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Interest</span>
                    <span className="font-medium text-red-400">${totalInterest.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-navy-700 pt-3">
                    <span className="text-gray-400">Interest as % of Vehicle Price</span>
                    <span className="font-semibold">{((totalInterest / vehiclePrice) * 100).toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="button-generate-quote"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Quote
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  data-testid="button-compare-options"
                >
                  Compare Options
                </Button>
              </div>
            </div>
          </div>

          {/* Payment Comparison Table */}
          <Card className="bg-navy-800/50 border-navy-600 mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-400" />
                Payment Comparison by Term
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-700">
                      <th className="text-left py-3">Term</th>
                      <th className="text-right py-3">Monthly Payment</th>
                      <th className="text-right py-3">Total Interest</th>
                      <th className="text-right py-3">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[36, 48, 60, 72].map((term) => {
                      const termRate = interestRate[0] / 100 / 12;
                      const termPayment = loanAmount > 0 && termRate > 0
                        ? (loanAmount * termRate * Math.pow(1 + termRate, term)) / (Math.pow(1 + termRate, term) - 1)
                        : 0;
                      const termTotal = termPayment * term + downPayment + tradeValue;
                      const termInterest = termTotal - vehiclePrice;
                      
                      return (
                        <tr key={term} className="border-b border-navy-700/50">
                          <td className="py-3">{term} months ({(term / 12).toFixed(1)} years)</td>
                          <td className="text-right py-3 font-medium">${termPayment.toFixed(2)}</td>
                          <td className="text-right py-3 text-red-400">${termInterest.toFixed(2)}</td>
                          <td className="text-right py-3 font-semibold">${termTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}