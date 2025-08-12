import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { 
  Home, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Phone, 
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calculator,
  Target,
  Briefcase,
  Plus,
  CreditCard
} from "lucide-react";

interface LoanApplication {
  id: string;
  clientName: string;
  loanAmount: number;
  loanType: string;
  status: 'pre_approval' | 'application' | 'underwriting' | 'approved' | 'closed' | 'denied';
  creditScore: number;
  submittedDate: string;
  expectedClose: string;
}

interface BrokerStats {
  totalLoans: number;
  loanVolume: number;
  commissionEarned: number;
  averageLoanSize: number;
  closingRate: number;
  activePipeline: number;
}

export default function MortgageBrokerDashboard() {
  const { user } = useAuth();

  const mockStats: BrokerStats = {
    totalLoans: 45,
    loanVolume: 12750000,
    commissionEarned: 89250,
    averageLoanSize: 425000,
    closingRate: 87,
    activePipeline: 23,
  };

  const mockApplications: LoanApplication[] = [
    {
      id: '1',
      clientName: 'Sarah & David Chen',
      loanAmount: 485000,
      loanType: 'Conventional 30-Year',
      status: 'underwriting',
      creditScore: 742,
      submittedDate: '2024-01-10',
      expectedClose: '2024-02-15',
    },
    {
      id: '2',
      clientName: 'Michael Rodriguez',
      loanAmount: 325000,
      loanType: 'FHA 30-Year',
      status: 'approved',
      creditScore: 698,
      submittedDate: '2024-01-08',
      expectedClose: '2024-02-10',
    },
    {
      id: '3',
      clientName: 'Jennifer & Mark Wilson',
      loanAmount: 750000,
      loanType: 'Jumbo 15-Year',
      status: 'application',
      creditScore: 785,
      submittedDate: '2024-01-12',
      expectedClose: '2024-02-20',
    },
  ];

  const getStatusColor = (status: LoanApplication['status']) => {
    switch (status) {
      case 'pre_approval': return 'bg-blue-500';
      case 'application': return 'bg-yellow-500';
      case 'underwriting': return 'bg-orange-500';
      case 'approved': return 'bg-green-500';
      case 'closed': return 'bg-emerald-500';
      case 'denied': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: LoanApplication['status']) => {
    switch (status) {
      case 'pre_approval': return 'Pre-Approval';
      case 'application': return 'Application';
      case 'underwriting': return 'Underwriting';
      case 'approved': return 'Approved';
      case 'closed': return 'Closed';
      case 'denied': return 'Denied';
      default: return status;
    }
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 740) return 'text-green-600 bg-green-100';
    if (score >= 670) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Home className="h-8 w-8 text-green-500 mr-3" />
          Mortgage Broker Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Manage loan applications, track pipeline, and grow your business</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Pipeline</p>
                <p className="text-2xl font-bold text-white">{mockStats.activePipeline}</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Loan Volume</p>
                <p className="text-2xl font-bold text-white">${(mockStats.loanVolume / 1000000).toFixed(1)}M</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Commission Earned</p>
                <p className="text-2xl font-bold text-white">${mockStats.commissionEarned.toLocaleString()}</p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Closing Rate</p>
                <p className="text-2xl font-bold text-white">{mockStats.closingRate}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Loan Pipeline */}
        <div className="lg:col-span-2">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Active Loan Applications
                </CardTitle>
                <Button size="sm" className="bg-green-500 hover:bg-green-600">
                  <Plus className="h-4 w-4 mr-2" />
                  New Application
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockApplications.map((app) => (
                  <div key={app.id} className="p-4 bg-navy-600 rounded-lg border border-navy-500">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(app.status)}`}></div>
                        <h3 className="font-semibold text-white">{app.clientName}</h3>
                        <Badge className={getCreditScoreColor(app.creditScore)} variant="secondary">
                          {app.creditScore} FICO
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-400">{getStatusText(app.status)}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Loan Amount</p>
                        <p className="text-white">${app.loanAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Loan Type</p>
                        <p className="text-white">{app.loanType}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Submitted</p>
                        <p className="text-white">{new Date(app.submittedDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Expected Close</p>
                        <p className="text-white">{new Date(app.expectedClose).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <Button size="sm" variant="outline" className="border-navy-400 text-gray-300">
                        <Phone className="h-3 w-3 mr-1" />
                        Contact
                      </Button>
                      <Button size="sm" variant="outline" className="border-navy-400 text-gray-300">
                        <FileText className="h-3 w-3 mr-1" />
                        View File
                      </Button>
                      <Button size="sm" variant="outline" className="border-navy-400 text-gray-300">
                        <Calculator className="h-3 w-3 mr-1" />
                        Calculate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Items & Tools */}
        <div className="space-y-6">
          {/* Urgent Actions */}
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                Urgent Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">2 loans closing this week</p>
                    <p className="text-red-400 text-xs">Documentation needed</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-500 text-red-400">
                    Review
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">5 rate locks expiring</p>
                    <p className="text-yellow-400 text-xs">Extend or close</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-yellow-500 text-yellow-400">
                    Act Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tools */}
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Quick Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-green-500 hover:bg-green-600 text-white justify-start">
                  <Calculator className="h-4 w-4 mr-2" />
                  Loan Calculator
                </Button>
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Rate Sheet
                </Button>
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Pre-Approval Letter
                </Button>
                <Button variant="outline" className="w-full border-navy-400 text-gray-300 justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Find Realtors
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Rates */}
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Today's Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">30-Year Fixed</span>
                  <span className="text-white font-semibold">6.85%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">15-Year Fixed</span>
                  <span className="text-white font-semibold">6.45%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">5/1 ARM</span>
                  <span className="text-white font-semibold">6.25%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">FHA 30-Year</span>
                  <span className="text-white font-semibold">6.75%</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Rates updated: Today 9:00 AM
              </p>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">This Month's Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Loan Volume</span>
                    <span className="text-white">$2.8M / $3.5M</span>
                  </div>
                  <Progress value={80} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Applications</span>
                    <span className="text-white">12 / 15</span>
                  </div>
                  <Progress value={80} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Closing Rate</span>
                    <span className="text-white">87%</span>
                  </div>
                  <Progress value={87} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}