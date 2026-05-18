import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Users,
  CheckCircle,
  ArrowRight,
  DollarSign,
  Briefcase,
  FileText,
} from "lucide-react";
import { PublicHeatmap } from "@/components/PublicHeatmap";
import { InteractiveCountyMap } from "@/components/InteractiveCountyMap";

export default function ForContractors() {
  const { user, isAuthenticated } = useAuth();
  const isContractor = user && user.role === "contractor_user";

  // Get total site-wide contractor count
  const { data: allContractors } = useQuery({
    queryKey: ["/api/contractors"],
    queryFn: async () => {
      const response = await fetch("/api/contractors?limit=10000");
      if (!response.ok) throw new Error("Failed to fetch contractors");
      return response.json();
    },
  });

  const totalContractorCount = allContractors?.length || 0;

  return (
    <div className="">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header - this is the Contractors tab under Direct Connect */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-ts-orange mb-6">
            Contractors · Direct Connect Responders
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto mb-4">
            This is the Contractors tab under Direct Connect: grow your business by responding to
            homeowner Direct Connect requests and staying visible in your local coordination board.
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-tsCard rounded-full border border-white/10">
            <Users className="h-5 w-5 text-ts-orange mr-2" />
            <span className="text-white/70">
              Homeowners start Direct Connect requests · you respond here as a verified local pro
            </span>
          </div>
          <div className="mt-2">
            <span className="text-ts-orange font-semibold">
              {totalContractorCount} contractors available
            </span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Legacy Growth Pack (retired) */}
          <Card className="bg-tsCard border-white/10 glow-effect">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-ts-orange flex items-center">
                  <Download className="h-6 w-6 mr-2 text-ts-orange" />
                  Free Growth Pack
                </CardTitle>
                <Badge className="bg-ts-orange text-white">FREE</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-white/70">
                Get instant access to proven marketing strategies, pricing guides, and business
                growth tools specifically designed for contractors.
              </p>

              <div className="space-y-2">
                <div className="flex items-center text-sm text-white/70">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Outreach templates
                </div>
                <div className="flex items-center text-sm text-white/70">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Pricing strategy guides
                </div>
                <div className="flex items-center text-sm text-white/70">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Customer communication scripts
                </div>
                <div className="flex items-center text-sm text-white/70">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                  Business growth checklists
                </div>
              </div>

              {/* Growth Pack download retired */}
            </CardContent>
          </Card>

          {/* Legacy paid-growth surface retired */}
        </div>

        {/* Additional Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-colors">
            <CardContent className="p-6 text-center">
              <Briefcase className="h-12 w-12 text-ts-orange mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-ts-orange mb-2">Contractor Dashboard</h3>
              <p className="text-white/70 text-sm mb-4">
                Manage your projects, track opportunities, and monitor your business performance.
              </p>
              {isContractor ? (
                <Link href="/business-dashboard">
                  <Button
                    variant="outline"
                    className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white hover:text-white"
                  >
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <Link href="/businesses/apply">
                  <Button
                    variant="outline"
                    className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white hover:text-white"
                  >
                    Join Now
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-colors">
            <CardContent className="p-6 text-center">
              <DollarSign className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-ts-orange mb-2">Find Homeowners</h3>
              <p className="text-white/70 text-sm mb-4">
                Connect with homeowners actively seeking contractors in your area.
              </p>
              <Link href="/contractors/board">
                <Button
                  variant="outline"
                  className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                >
                  View Opportunities
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10 hover:border-ts-orange/30 transition-colors">
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-ts-orange mb-2">Business Resources</h3>
              <p className="text-white/70 text-sm mb-4">
                Access contracts, pricing guides, and industry best practices.
              </p>
              {/* Legacy Growth Pack resources entry retired */}
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-navy-700 to-navy-600 border-white/10">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-ts-orange mb-4">
                Ready to Grow Your Business?
              </h2>
              <p className="text-xl text-white/70 mb-6 max-w-2xl mx-auto">
                Join thousands of contractors who have transformed their businesses with TradeScout.
              </p>
              {/* Legacy growth CTA surfaces retired */}
            </CardContent>
          </Card>
        </div>

        {/* Interactive County Explorer */}
        <div className="mt-16">
          <InteractiveCountyMap variant="contractor" showTitle={true} className="max-w-full" />
        </div>
      </div>
    </div>
  );
}
