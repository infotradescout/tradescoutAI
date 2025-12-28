import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { 
  Shield, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Phone, 
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Target,
  Briefcase,
  Plus
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  policyType: string;
  premium: number;
  renewalDate: string;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  riskLevel: 'low' | 'medium' | 'high';
}

interface InsuranceStats {
  totalClients: number;
  totalPremiums: number;
  renewalsThisMonth: number;
  newPoliciesThisMonth: number;
  commissionEarned: number;
  quotesOutstanding: number;
}

export default function InsuranceAgentDashboard() {
  const { user } = useAuth();

  const mockStats: InsuranceStats = {
    totalClients: 127,
    totalPremiums: 1250000,
    renewalsThisMonth: 23,
    newPoliciesThisMonth: 8,
    commissionEarned: 18750,
    quotesOutstanding: 15,
  };

  const mockClients: Client[] = [
    {
      id: '1',
      name: 'Johnson Family',
      policyType: 'Home Insurance',
      premium: 1200,
      renewalDate: '2024-02-15',
      status: 'active',
      riskLevel: 'low',
    },
    {
      id: '2',
      name: 'Smith Contractors LLC',
      policyType: 'General Liability',
      premium: 3200,
      renewalDate: '2024-01-30',
      status: 'pending',
      riskLevel: 'medium',
    },
    {
      id: '3',
      name: 'Martinez Auto Repair',
      policyType: 'Commercial Property',
      premium: 2400,
      renewalDate: '2024-03-10',
      status: 'active',
      riskLevel: 'high',
    },
  ];

  const getStatusColor = (status: Client['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'expired': return 'bg-red-500';
      case 'cancelled': return 'bg-slate-900/60';
      default: return 'bg-slate-900/60';
    }
  };

  const getRiskColor = (risk: Client['riskLevel']) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-slate-900';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Shield className="h-8 w-8 text-blue-500 mr-3" />
          Insurance Agent Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Manage policies, track renewals, and grow your client base</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Clients</p>
                <p className="text-2xl font-bold text-white">{mockStats.totalClients}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Premiums</p>
                <p className="text-2xl font-bold text-white">${mockStats.totalPremiums.toLocaleString()}</p>
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
                <p className="text-sm font-medium text-gray-400">Renewals This Month</p>
                <p className="text-2xl font-bold text-white">{mockStats.renewalsThisMonth}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Client Portfolio */}
        <div className="lg:col-span-2">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center">
                  <Briefcase className="h-5 w-5 mr-2" />
                  Recent Client Activity
                </CardTitle>
                <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                  <Plus className="h-4 w-4 mr-2" />
                  New Client
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockClients.map((client) => (
                  <div key={client.id} className="p-4 bg-navy-600 rounded-lg border border-navy-500">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(client.status)}`}></div>
                        <h3 className="font-semibold text-white">{client.name}</h3>
                        <Badge className={getRiskColor(client.riskLevel)} variant="secondary">
                          {client.riskLevel} risk
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-400 capitalize">{client.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Policy Type</p>
                        <p className="text-white">{client.policyType}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Annual Premium</p>
                        <p className="text-white">${client.premium.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Renewal Date</p>
                        <p className="text-white">{new Date(client.renewalDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-3">
                      <Button size="sm" variant="outline" className="border-navy-400 text-gray-300">
                        <Phone className="h-3 w-3 mr-1" />
                        Contact
                      </Button>
                      <Button size="sm" variant="outline" className="border-navy-400 text-gray-300">
                        <FileText className="h-3 w-3 mr-1" />
                        View Policy
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
                    <p className="text-white text-sm font-medium">3 policies expiring this week</p>
                    <p className="text-red-400 text-xs">Renewal required</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-500 text-red-400">
                    Review
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">15 quotes pending</p>
                    <p className="text-yellow-400 text-xs">Follow up needed</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-yellow-500 text-yellow-400">
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}