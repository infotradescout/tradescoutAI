import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TestTube, Bug, Settings, Eye, EyeOff, Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TestingErrorReportButton } from "@/components/TestingErrorReportButton";

export default function AdminTestingControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["/api/admin/testing-settings"],
  });

  const { data: reportStats = {}, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/admin/error-report-stats"],
  });

  const settingsData = settings as any;
  const statsData = reportStats as any;

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/admin/testing-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/testing-settings"] });
      toast({
        title: "Settings Updated",
        description: "Testing controls have been updated successfully.",
      });
    },
  });

  const clearTestDataMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/admin/clear-test-data");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-report-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-reports"] });
      toast({
        title: "Test Data Cleared",
        description: "All test error reports have been removed.",
      });
    },
  });

  const generateTestDataMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/generate-test-data");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-report-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-reports"] });
      toast({
        title: "Test Data Generated",
        description: "Sample error reports have been created for testing.",
      });
    },
  });

  const handleSettingChange = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className=" text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-tsCard rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className=" text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <TestTube className="h-8 w-8 text-ts-orange" />
            Testing Controls
          </h1>
          <p className="text-white/60">Manage testing features and bug reporting system settings</p>
        </div>

        {/* Bug Report System Controls */}
        <Card className="bg-tsCard border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bug className="h-5 w-5 text-ts-orange" />
              Bug Report System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* System Status */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white/70 text-base font-semibold">
                  Enable Bug Report System
                </Label>
                <p className="text-white/60 text-sm">
                  Show bug report buttons throughout the application
                </p>
              </div>
              <Switch
                checked={settingsData.bugReportEnabled ?? true}
                onCheckedChange={(checked) => handleSettingChange("bugReportEnabled", checked)}
              />
            </div>

            <Separator className="bg-tsCard" />

            {/* Testing Mode */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white/70 text-base font-semibold">Testing Mode</Label>
                <p className="text-white/60 text-sm">
                  Show enhanced testing features and sample data generation
                </p>
              </div>
              <Switch
                checked={settingsData.testingModeEnabled ?? false}
                onCheckedChange={(checked) => handleSettingChange("testingModeEnabled", checked)}
              />
            </div>

            {/* Banner Display */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white/70 text-base font-semibold">Show Testing Banner</Label>
                <p className="text-white/60 text-sm">
                  Display prominent testing banner on landing page
                </p>
              </div>
              <Switch
                checked={settingsData.showTestingBanner ?? false}
                onCheckedChange={(checked) => handleSettingChange("showTestingBanner", checked)}
              />
            </div>

            {/* Test Component Preview */}
            <div className="bg-tsCard border border-white/10 rounded-lg p-4">
              <Label className="text-white/70 text-sm font-semibold mb-3 block">
                Testing Component Preview:
              </Label>
              <div className="space-y-3">
                <TestingErrorReportButton variant="prominent" />
                <TestingErrorReportButton variant="floating" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Report Statistics */}
        <Card className="bg-tsCard border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-ts-orange" />
              Error Report Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-tsCard h-16 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-tsCard rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-ts-orange">{statsData.total || 0}</div>
                  <div className="text-white/70 text-sm">Total Reports</div>
                </div>
                <div className="bg-tsCard rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{statsData.open || 0}</div>
                  <div className="text-white/70 text-sm">Open Issues</div>
                </div>
                <div className="bg-tsCard rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {statsData.inProgress || 0}
                  </div>
                  <div className="text-white/70 text-sm">In Progress</div>
                </div>
                <div className="bg-tsCard rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{statsData.resolved || 0}</div>
                  <div className="text-white/70 text-sm">Resolved</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Testing Data Management */}
        <Card className="bg-tsCard border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-ts-orange" />
              Testing Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => generateTestDataMutation.mutate()}
                disabled={generateTestDataMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <TestTube className="h-4 w-4 mr-2" />
                {generateTestDataMutation.isPending ? "Generating..." : "Generate Test Reports"}
              </Button>

              <Button
                onClick={() => clearTestDataMutation.mutate()}
                disabled={clearTestDataMutation.isPending}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {clearTestDataMutation.isPending ? "Clearing..." : "Clear Test Data"}
              </Button>
            </div>

            <div className="bg-ts-orange/10 border border-ts-orange/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TestTube className="h-5 w-5 text-ts-orange mt-0.5" />
                <div>
                  <h4 className="text-ts-orange font-semibold">Testing Instructions</h4>
                  <ul className="text-ts-orange text-sm mt-2 space-y-1">
                    <li>• Enable "Testing Mode" to show enhanced bug report features</li>
                    <li>• Use "Generate Test Reports" to create sample data for demonstration</li>
                    <li>• Testing banner appears on landing page when enabled</li>
                    <li>• All test reports are clearly labeled and can be cleared separately</li>
                    <li>• Regular users won't see testing features unless enabled</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="border-ts-orange/30 text-ts-orange">
                Admin Only Feature
              </Badge>
              <Badge variant="outline" className="border-blue-500/50 text-blue-300">
                Testing Environment
              </Badge>
              <Badge variant="outline" className="border-green-500/50 text-green-300">
                Removable Controls
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
