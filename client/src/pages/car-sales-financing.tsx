import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Calculator,
  FileText,
  CheckCircle,
  DollarSign,
  Percent,
  Calendar,
  Building,
  TrendingUp,
} from "lucide-react";

export default function CarSalesFinancing() {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("4.5");
  const [loanTerm, setLoanTerm] = useState("60");

  const calculatePayment = () => {
    const principal = parseFloat(loanAmount);
    const rate = parseFloat(interestRate) / 100 / 12;
    const months = parseInt(loanTerm);

    if (principal && rate && months) {
      const payment =
        (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
      return payment.toFixed(2);
    }
    return "0.00";
  };

  const lenders = [
    {
      id: 1,
      name: "Prime Auto Credit",
      type: "Bank",
      rate: "3.99% - 7.99%",
      term: "12-84 months",
      minCredit: 680,
      status: "Active",
      approval: "Fast (2-4 hours)",
    },
    {
      id: 2,
      name: "Community First Bank",
      type: "Credit Union",
      rate: "3.49% - 6.99%",
      term: "24-72 months",
      minCredit: 650,
      status: "Active",
      approval: "Standard (24-48 hours)",
    },
    {
      id: 3,
      name: "AutoFinance Plus",
      type: "Specialty Lender",
      rate: "5.99% - 12.99%",
      term: "12-60 months",
      minCredit: 550,
      status: "Active",
      approval: "Instant",
    },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-8">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <CreditCard className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Financing Solutions</h1>
              <p className="text-gray-400">Help customers secure the best auto loans</p>
            </div>
          </div>

          <Tabs defaultValue="calculator" className="space-y-6">
            <TabsList className="bg-navy-800/50 border border-navy-600">
              <TabsTrigger value="calculator">Payment Calculator</TabsTrigger>
              <TabsTrigger value="lenders">Partner Lenders</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
            </TabsList>

            <TabsContent value="calculator" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calculator Input */}
                <Card className="bg-navy-800/50 border-navy-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-green-400" />
                      Loan Calculator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="loanAmount">Loan Amount ($)</Label>
                      <Input
                        id="loanAmount"
                        type="number"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value)}
                        placeholder="25000"
                        className="bg-navy-700/50 border-navy-600"
                        data-testid="input-loan-amount"
                      />
                    </div>

                    <div>
                      <Label htmlFor="interestRate">Interest Rate (%)</Label>
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.1"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="bg-navy-700/50 border-navy-600"
                        data-testid="input-interest-rate"
                      />
                    </div>

                    <div>
                      <Label htmlFor="loanTerm">Loan Term (months)</Label>
                      <Input
                        id="loanTerm"
                        type="number"
                        value={loanTerm}
                        onChange={(e) => setLoanTerm(e.target.value)}
                        className="bg-navy-700/50 border-navy-600"
                        data-testid="input-loan-term"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Calculator Results */}
                <Card className="bg-navy-800/50 border-navy-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-400" />
                      Payment Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center p-6 bg-green-500/10 rounded-lg">
                      <p className="text-sm text-gray-400 mb-2">Monthly Payment</p>
                      <p className="text-3xl font-bold text-green-400">${calculatePayment()}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Principal</span>
                        <span>${loanAmount || "0"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Interest Rate</span>
                        <span>{interestRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Term</span>
                        <span>{loanTerm} months</span>
                      </div>
                      <div className="flex justify-between border-t border-navy-700 pt-3">
                        <span className="text-gray-400">Total Interest</span>
                        <span>
                          $
                          {(
                            parseFloat(calculatePayment()) * parseInt(loanTerm) -
                            parseFloat(loanAmount || "0")
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      data-testid="button-send-quote"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Send Quote to Customer
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="lenders" className="space-y-4">
              {lenders.map((lender) => (
                <Card key={lender.id} className="bg-navy-800/50 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                          <Building className="h-6 w-6 text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{lender.name}</h3>
                          <p className="text-sm text-gray-400">{lender.type}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-600">{lender.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Interest Rate</p>
                        <p className="font-medium flex items-center gap-2">
                          <Percent className="h-4 w-4 text-green-400" />
                          {lender.rate}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-400">Loan Terms</p>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          {lender.term}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-400">Min Credit Score</p>
                        <p className="font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-orange-400" />
                          {lender.minCredit}+
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-400">Approval Time</p>
                        <p className="font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          {lender.approval}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-submit-application"
                      >
                        Submit Application
                      </Button>
                      <Button size="sm" variant="outline" data-testid="button-view-rates">
                        View Current Rates
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="applications">
              <Card className="bg-navy-800/50 border-navy-600">
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Applications</h3>
                  <p className="text-gray-400 mb-6">
                    Customer financing applications will appear here
                  </p>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-new-application"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Start New Application
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
