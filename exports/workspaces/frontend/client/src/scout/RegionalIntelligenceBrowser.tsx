/**
 * Regional Intelligence Browser
 *
 * A powerful sidebar that opens when you click a county on the heatmap.
 * Shows all Scout intelligence, contractors, users, and files for that region.
 *
 * Features:
 * - Scout findings overview
 * - Contractor directory
 * - User activity
 * - File browser
 * - Opportunities and risks
 * - Quick actions (trigger missions, export data)
 */

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  FileText,
  Users,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  Download,
  RefreshCw,
  X,
  MapPin,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface RegionalIntelligenceBrowserProps {
  fips: string;
  county: string;
  state: string;
  onClose: () => void;
}

interface CountyIntelligenceData {
  fips: string;
  county: string;
  state: string;
  scoutFindings: {
    buildingCodes: number;
    pricingData: number;
    tradeGuides: number;
    recentReports: number;
  };
  contractors: {
    total: number;
    active: number;
    byTrade: Record<string, number>;
    topContractors: any[];
  };
  users: {
    total: number;
    homeowners: number;
    contractors: number;
    recentActivity: number;
  };
  files: {
    total: number;
    byType: Record<string, number>;
    recentFiles: any[];
  };
  opportunities: any[];
  risks: any[];
  metrics: {
    activityScore: number;
    opportunityScore: number;
    dataCompleteness: number;
    trendDirection: "up" | "stable" | "down";
    competitionLevel: "low" | "medium" | "high";
  };
  lastUpdated: Date;
}

export const RegionalIntelligenceBrowser: React.FC<RegionalIntelligenceBrowserProps> = ({
  fips,
  county,
  state,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch county intelligence
  const { data: intelligence, isLoading } = useQuery<CountyIntelligenceData>({
    queryKey: [`/api/heatmap/county/${fips}`],
    queryFn: () => apiRequest("GET", `/api/heatmap/county/${fips}`),
  });

  if (!intelligence) {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="font-bold text-white">
              {county}, {state}
            </h2>
            <p className="text-xs text-slate-400">FIPS: {fips}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="border-b border-slate-700 p-4 grid grid-cols-2 gap-2">
        <div className="bg-slate-800 rounded p-2">
          <p className="text-xs text-slate-400">Activity</p>
          <p className="text-lg font-bold text-blue-400">{intelligence.metrics.activityScore}</p>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <p className="text-xs text-slate-400">Opportunity</p>
          <p className="text-lg font-bold text-green-400">
            {intelligence.metrics.opportunityScore}
          </p>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <p className="text-xs text-slate-400">Data Complete</p>
          <p className="text-lg font-bold text-purple-400">
            {intelligence.metrics.dataCompleteness}%
          </p>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <p className="text-xs text-slate-400">Trend</p>
          <p
            className={`text-lg font-bold ${
              intelligence.metrics.trendDirection === "up"
                ? "text-green-400"
                : intelligence.metrics.trendDirection === "down"
                  ? "text-red-400"
                  : "text-yellow-400"
            }`}
          >
            {intelligence.metrics.trendDirection === "up"
              ? "↑"
              : intelligence.metrics.trendDirection === "down"
                ? "↓"
                : "→"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-slate-700 bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="contractors"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
          >
            Contractors
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
          >
            Files
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
          >
            Actions
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Scout Findings */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Scout Findings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Building Codes</span>
                    <span className="font-bold text-blue-400">
                      {intelligence.scoutFindings.buildingCodes}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pricing Data</span>
                    <span className="font-bold text-green-400">
                      {intelligence.scoutFindings.pricingData}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trade Guides</span>
                    <span className="font-bold text-purple-400">
                      {intelligence.scoutFindings.tradeGuides}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recent Reports</span>
                    <span className="font-bold text-orange-400">
                      {intelligence.scoutFindings.recentReports}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Users & Contractors */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-2xl font-bold text-blue-400">{intelligence.users.total}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {intelligence.users.homeowners} homeowners
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      Contractors
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-2xl font-bold text-green-400">
                      {intelligence.contractors.total}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {intelligence.contractors.active} active
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Opportunities */}
              {intelligence.opportunities.length > 0 && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {intelligence.opportunities.map((opp: any) => (
                      <div key={opp.id} className="text-sm">
                        <p className="font-medium text-white">{opp.title}</p>
                        <p className="text-xs text-slate-400">{opp.description}</p>
                        <Badge className="mt-1 bg-green-900 text-green-200">
                          Score: {opp.score}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Risks */}
              {intelligence.risks.length > 0 && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {intelligence.risks.map((risk: any) => (
                      <div key={risk.id} className="text-sm">
                        <p className="font-medium text-white">{risk.title}</p>
                        <Badge
                          className={`mt-1 ${
                            risk.severity === "critical"
                              ? "bg-red-900 text-red-200"
                              : risk.severity === "high"
                                ? "bg-orange-900 text-orange-200"
                                : "bg-yellow-900 text-yellow-200"
                          }`}
                        >
                          {risk.severity}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Contractors Tab */}
        <TabsContent value="contractors" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {intelligence.contractors.topContractors.map((contractor: any) => (
                <Card key={contractor.id} className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">{contractor.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{contractor.trade}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-sm font-bold text-yellow-400">
                            {contractor.rating}
                          </span>
                          <span className="text-xs text-slate-400">({contractor.reviewCount})</span>
                        </div>
                      </div>
                      <Badge
                        className={`${
                          contractor.availability === "high"
                            ? "bg-green-900 text-green-200"
                            : contractor.availability === "medium"
                              ? "bg-yellow-900 text-yellow-200"
                              : "bg-red-900 text-red-200"
                        }`}
                      >
                        {contractor.availability}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="flex-1 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            />
          </div>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {intelligence.files.recentFiles.map((file: any) => (
                <Card key={file.id} className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{file.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{file.type}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                <RefreshCw className="w-4 h-4 mr-2" />
                Scout for Codes
              </Button>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                <RefreshCw className="w-4 h-4 mr-2" />
                Scout for Pricing
              </Button>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                <RefreshCw className="w-4 h-4 mr-2" />
                Scout for Contractors
              </Button>
              <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
              <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white">
                <Filter className="w-4 h-4 mr-2" />
                Compare with Another County
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="border-t border-slate-700 p-2 text-xs text-slate-500 text-center">
        Last updated: {new Date(intelligence.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};
