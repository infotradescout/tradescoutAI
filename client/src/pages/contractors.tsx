import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { 
  Download, 
  TrendingUp, 
  Users, 
  Star, 
  CheckCircle, 
  ArrowRight,
  Target,
  DollarSign,
  Clock,
  Award,
  Briefcase,
  FileText
} from "lucide-react";

export default function ForContractors() {
  const { user, isAuthenticated } = useAuth();
  const isContractor = user && user.role && ['contractor_user', 'accelerator_member'].includes(user.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Grow Your Contracting Business
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Access exclusive resources, join our accelerator program, and connect with homeowners 
            looking for quality contractors in your area.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Free Growth Pack */}
          <Card className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/50 glow-effect">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-white flex items-center">
                  <Download className="h-6 w-6 mr-2 text-orange-500" />
                  Free Growth Pack
                </CardTitle>
                <Badge className="bg-orange-500 text-white">
                  FREE
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300">
                Get instant access to proven marketing strategies, pricing guides, and business growth tools 
                specifically designed for contractors.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-300">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Lead generation templates
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Pricing strategy guides
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Customer communication scripts
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Business growth checklists
                </div>
              </div>

              <Link href="/growth-pack">
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 text-lg font-semibold">
                  Download Free Growth Pack
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Accelerator Program */}
          <Card className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-white flex items-center">
                  <Award className="h-6 w-6 mr-2 text-purple-500" />
                  Accelerator Program
                </CardTitle>
                <Badge className="bg-purple-500 text-white">
                  PREMIUM
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300">
                Join our exclusive accelerator program for advanced business coaching, priority leads, 
                and networking opportunities with top contractors.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-300">
                  <Star className="h-4 w-4 mr-2 text-yellow-400" />
                  1-on-1 business coaching
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <Target className="h-4 w-4 mr-2 text-blue-400" />
                  Priority lead access
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <Users className="h-4 w-4 mr-2 text-green-400" />
                  Exclusive contractor network
                </div>
                <div className="flex items-center text-sm text-gray-300">
                  <TrendingUp className="h-4 w-4 mr-2 text-purple-400" />
                  Advanced marketing tools
                </div>
              </div>

              {isContractor ? (
                <Link href="/contractors/accelerator">
                  <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 text-lg font-semibold">
                    Join Accelerator Program
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Link href="/contractors/apply">
                  <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 text-lg font-semibold">
                    Apply to Join
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-navy-700 border-navy-600 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6 text-center">
              <Briefcase className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Contractor Dashboard</h3>
              <p className="text-gray-300 text-sm mb-4">
                Manage your leads, track projects, and monitor your business performance.
              </p>
              {isContractor ? (
                <Link href="/contractors/dashboard">
                  <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <Link href="/contractors/apply">
                  <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                    Join Now
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6 text-center">
              <DollarSign className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Lead Generation</h3>
              <p className="text-gray-300 text-sm mb-4">
                Get connected with homeowners actively seeking contractors in your area.
              </p>
              <Link href="/contractors/board">
                <Button variant="outline" className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white">
                  View Opportunities
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Business Resources</h3>
              <p className="text-gray-300 text-sm mb-4">
                Access contracts, pricing guides, and industry best practices.
              </p>
              <Link href="/growth-pack">
                <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white">
                  Get Resources
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-navy-700 to-navy-600 border-navy-500">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Grow Your Business?
              </h2>
              <p className="text-xl text-gray-300 mb-6 max-w-2xl mx-auto">
                Join thousands of contractors who have transformed their businesses with Trade Scout.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/growth-pack">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg">
                    Start with Free Pack
                  </Button>
                </Link>
                {!isContractor && (
                  <Link href="/contractors/apply">
                    <Button variant="outline" className="border-white text-white hover:bg-white hover:text-navy-800 px-8 py-3 text-lg">
                      Accelerator Program
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}