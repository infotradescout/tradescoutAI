import { useState, useEffect, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UIMonitoringDashboard } from "@/components/admin/UIMonitoringDashboard";
import { AICodeFixingDashboard } from "@/components/admin/AICodeFixingDashboard"; // Assuming this component exists
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserHeatmap } from "@/components/UserHeatmap";
import { FinanceLedgerPanel } from "@/components/admin/FinanceLedgerPanel";
import { AuthorityOperations } from "@/components/admin/AuthorityOperations";
import { Plus, Edit, Trash2, Gift, Settings, Megaphone, Users, Bell, Map, CheckCircle, Bug, Image, BarChart3, DollarSign, Wrench, MapPin, Clock, Bot, Shield, AlertTriangle, Eye, Database, Lock, Crown, Globe, Upload, KeyRound, Info } from "lucide-react";
import { useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";



type SiteSetting = {
  id: string;
  category: string;
  key: string;
  value: any;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type BroadcastSegment = "all" | "homeowners" | "contractors" | "pros" | "admins";

type PrizeConfiguration = {
  id: string;
  name: string;
  description?: string;
  prizeType: string;
  value: string;
  vendor?: string;
  isActive: boolean;
  probability: string;
  terms?: string;
  expirationDays: number;
  createdAt: string;
  updatedAt: string;
};

type Advertisement = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  placement: string;
  targetAudience: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  clickCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

type ContractorSetting = {
  id: string;
  category: string;
  setting: string;
  value: any;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState("heatmap");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [broadcastSegment, setBroadcastSegment] = useState<BroadcastSegment>("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastEmail, setBroadcastEmail] = useState(false);
  const [broadcastPush, setBroadcastPush] = useState(false);
  const [broadcastCampaignType, setBroadcastCampaignType] = useState("");
  const [broadcastTags, setBroadcastTags] = useState("");
  const [broadcastTargetState, setBroadcastTargetState] = useState("");
  const [broadcastMarketingOnly, setBroadcastMarketingOnly] = useState(false);

  // Allow deep-linking directly into specific tabs (e.g. finance, notification-ops)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const search = window.location.search;
      if (!search) return;
      const params = new URLSearchParams(search);
      const tab = params.get("tab");
      if (!tab) return;
      const allowedTabs = new Set([
        "heatmap",
        "prizes",
        "advertisements",
        "site-settings",
        "contractor-settings",
        "monitoring",
        "notification-ops",
        "error-reports",
        "ai-fixes",
        "pricing",
        "finance",
        "llm-admin",
        "authority",
      ]);
      if (allowedTabs.has(tab)) {
        setSelectedTab(tab);
      }
    } catch {
      // ignore malformed query params
    }
  }, []);

  // Check admin access
  const isSuperAdmin = ['owner', 'ops_admin', 'admin', 'super_admin', 'head_admin'].includes(user?.role || '');
  if (!isAuthenticated || !user || !isSuperAdmin) {
    return (
      <div className="bg-slate-950 flex items-center justify-center py-24">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">You need admin privileges to access this panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch data for each tab
  const { data: prizes = [], isLoading: prizesLoading } = useQuery({
    queryKey: ["/api/admin/prizes"],
    retry: false,
  });

  const { data: advertisements = [], isLoading: adsLoading } = useQuery({
    queryKey: ["/api/admin/advertisements"],
    retry: false,
  });

  const { data: siteSettings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/admin/site-settings"],
    retry: false,
  });

  const { data: contractorSettings = [], isLoading: contractorSettingsLoading } = useQuery({
    queryKey: ["/api/admin/contractor-settings"],
    retry: false,
  });

  // Mutations for CRUD operations
  const createMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string; data: any }) => {
      return apiRequest("POST", `/api/admin/${type}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Success",
        description: "Item created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ type, id, data }: { type: string; id: string; data: any }) => {
      return apiRequest("PUT", `/api/admin/${type}/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      return apiRequest("DELETE", `/api/admin/${type}/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testPushMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/test-push-notification", {});
    },
    onSuccess: () => {
      toast({
        title: "Test notification sent",
        description: "Check your in-app notifications and push-enabled device.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const methods = ["in_app"] as string[];
      if (broadcastEmail) methods.push("email");
      if (broadcastPush) methods.push("push");

      const tags = broadcastTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const targetFilters: any = {};
      if (broadcastTargetState.trim()) {
        targetFilters.stateCodes = [broadcastTargetState.trim().toUpperCase()];
      }
      if (broadcastMarketingOnly) {
        targetFilters.onlyWithMarketingEmails = true;
      }

      return apiRequest("POST", "/api/admin/notifications/broadcast", {
        segment: broadcastSegment,
        title: broadcastTitle,
        message: broadcastMessage,
        deliveryMethods: methods,
        campaignType: broadcastCampaignType.trim() || undefined,
        tags,
        targetFilters,
      });
    },
    onSuccess: (data: any) => {
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastEmail(false);
      setBroadcastPush(false);
      setBroadcastCampaignType("");
      setBroadcastTags("");
      setBroadcastTargetState("");
      setBroadcastMarketingOnly(false);
      toast({
        title: "Broadcast sent",
        description:
          typeof data?.targetCount === "number"
            ? `Delivered to ${data.targetCount} users in segment ${data.segment || broadcastSegment}.`
            : "Announcement broadcast has been queued.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Broadcast failed",
        description: error?.message || "Unable to send announcement.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = (type: string, id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteMutation.mutate({ type, id });
    }
  };

  const handleSubmit = (formData: any) => {
    const type = selectedTab === "contractor-settings" ? "contractor-settings" : selectedTab;

    if (editingItem) {
      updateMutation.mutate({ type, id: editingItem.id, data: formData });
    } else {
      createMutation.mutate({ type, data: formData });
    }
  };

  return (
    <div className="bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="w-8 h-8 text-orange-500" />
            Admin Panel
          </h1>
          <p className="text-gray-400">Manage site features, prizes, advertisements, contractor settings, and AI monitoring</p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList
            className="grid w-full grid-cols-12"
            style={{ backgroundColor: "var(--surface-frame)" }}
          >
            <TabsTrigger value="heatmap" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              User Heatmap
            </TabsTrigger>
            <TabsTrigger value="prizes" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Prizes
            </TabsTrigger>
            <TabsTrigger value="advertisements" className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Ads
            </TabsTrigger>
            <TabsTrigger value="site-settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Site Settings
            </TabsTrigger>
            <TabsTrigger value="contractor-settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Contractor Settings
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              AI Monitoring
            </TabsTrigger>
            <TabsTrigger value="notification-ops" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Notification Ops
            </TabsTrigger>
            <TabsTrigger value="error-reports" className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Error Reports
            </TabsTrigger>
            <TabsTrigger value="ai-fixes" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Fixes
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Pricing Analytics
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="llm-admin" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              LLM Admin
            </TabsTrigger>
            <TabsTrigger value="authority" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Authority Ops
            </TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap" className="space-y-4">
            <UserHeatmap />
          </TabsContent>

          <TabsContent value="prizes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Prize Configurations</h2>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setIsDialogOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Prize
              </Button>
            </div>

            {prizesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton-enhanced h-48 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(prizes as PrizeConfiguration[]).map((prize: PrizeConfiguration) => (
                  <Card key={prize.id} className="card-enhanced">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg text-white">{prize.name}</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(prize)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete("prizes", prize.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={prize.isActive ? "default" : "secondary"}>
                          {prize.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">{prize.prizeType}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 text-sm mb-2">{prize.description}</p>
                      <div className="space-y-1 text-xs text-gray-400">
                        <p><strong>Value:</strong> {prize.value}</p>
                        <p><strong>Probability:</strong> {(parseFloat(prize.probability) * 100).toFixed(2)}%</p>
                        {prize.vendor && <p><strong>Vendor:</strong> {prize.vendor}</p>}
                        <p><strong>Expires:</strong> {prize.expirationDays} days</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="advertisements" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Advertisements</h2>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setIsDialogOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Advertisement
              </Button>
            </div>

            {adsLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton-enhanced h-32 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(advertisements as Advertisement[]).map((ad: Advertisement) => (
                  <Card key={ad.id} className="card-enhanced">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg text-white">{ad.title}</CardTitle>
                          <div className="flex gap-2 mt-2">
                            <Badge variant={ad.isActive ? "default" : "secondary"}>
                              {ad.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline">{ad.placement}</Badge>
                            <Badge variant="outline">{ad.targetAudience}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(ad)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete("advertisements", ad.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 text-sm mb-3">{ad.content}</p>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Views: {ad.viewCount}</span>
                        <span>Clicks: {ad.clickCount}</span>
                        <span>CTR: {ad.viewCount > 0 ? ((ad.clickCount / ad.viewCount) * 100).toFixed(2) : 0}%</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="site-settings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Site Settings</h2>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setIsDialogOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Setting
              </Button>
            </div>

            {settingsLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton-enhanced h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(siteSettings as SiteSetting[]).map((setting: SiteSetting) => (
                  <Card key={setting.id} className="card-enhanced">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white">{setting.key}</h3>
                            <Badge variant="outline" className="text-xs">{setting.category}</Badge>
                            <Badge variant={setting.isActive ? "default" : "secondary"} className="text-xs">
                              {setting.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          {setting.description && (
                            <p className="text-gray-300 text-sm mb-2">{setting.description}</p>
                          )}
                          <div
                            className="text-xs text-gray-400 font-mono p-2 rounded"
                            style={{ backgroundColor: "var(--surface-card)" }}
                          >
                            {JSON.stringify(setting.value, null, 2)}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(setting)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete("site-settings", setting.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contractor-settings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Contractor Settings</h2>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setIsDialogOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Setting
              </Button>
            </div>

            {contractorSettingsLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton-enhanced h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(contractorSettings as ContractorSetting[]).map((setting: ContractorSetting) => (
                  <Card key={setting.id} className="card-enhanced">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white">{setting.setting}</h3>
                            <Badge variant="outline" className="text-xs">{setting.category}</Badge>
                            <Badge variant={setting.isActive ? "default" : "secondary"} className="text-xs">
                              {setting.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          {setting.description && (
                            <p className="text-gray-300 text-sm mb-2">{setting.description}</p>
                          )}
                          <div
                            className="text-xs text-gray-400 font-mono p-2 rounded"
                            style={{ backgroundColor: "var(--surface-card)" }}
                          >
                            {JSON.stringify(setting.value, null, 2)}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(setting)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete("contractor-settings", setting.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <UIMonitoringDashboard />
          </TabsContent>

          <TabsContent value="notification-ops" className="space-y-4">
            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Bell className="h-5 w-5 text-orange-500" />
                  Notification & Push Ops Runbook
                </CardTitle>
                <CardDescription className="text-gray-300">
                  How to verify in-app and push notifications end-to-end, plus a one-click heartbeat.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-100">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-slate-200">
                    Start here any time you need to confirm that contractor lead, system, or campaign notifications are
                    flowing correctly to users.
                  </p>
                  <Button
                    className="bg-orange-600 hover:bg-orange-700 whitespace-nowrap"
                    onClick={() => testPushMutation.mutate()}
                    disabled={testPushMutation.isPending}
                  >
                    {testPushMutation.isPending ? "Sending test..." : "Send test notification to me"}
                  </Button>
                </div>

                <Separator className="bg-slate-800" />

                <div className="space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Daily quick check (2–3 minutes)
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-200">
                    <li>Use the button above to send yourself a test notification (in-app + push).</li>
                    <li>Confirm it appears in the header bell dropdown and the full Notifications page.</li>
                    <li>If you have push enabled on this device, confirm a browser/device banner also appears.</li>
                    <li>If anything fails, move to the triage checklist below.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Database className="w-4 h-4 text-sky-400" />
                    Lead-driven push (contractor example)
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-200">
                    <li>Create or route a new project that assigns at least one contractor.</li>
                    <li>For that contractor account, make sure push is enabled in Settings &gt; Notifications.</li>
                    <li>Verify a new notification of type "New project request" appears (in-app + push, if enabled).</li>
                    <li>Click through the notification and confirm it lands on the correct dashboard view.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Triage checklist when something looks off
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-200">
                    <li>First, run the test button above and confirm the request succeeds (no error toast).</li>
                    <li>If in-app shows up but push does not, re-check browser permission and device subscription in user Settings.</li>
                    <li>If neither in-app nor push appears, confirm notification preferences for the user and type are not disabled.</li>
                    <li>Review server logs for notification creation/send errors and invalid push subscriptions being pruned.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    Environment notes
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-200">
                    <li>
                      Push requires a secure origin (https or localhost). In non-secure environments, in-app notifications will
                      still work but push will be unavailable.
                    </li>
                    <li>
                      If VAPID keys are missing or misconfigured, the system automatically falls back to in-app only; fix env
                      vars before re-testing push.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Megaphone className="h-5 w-5 text-orange-500" />
                  Broadcast / Announcement
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Send a short announcement to a targeted segment (homeowners, contractors, pros, or admins).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-100">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-segment">Segment</Label>
                    <Select
                      value={broadcastSegment}
                      onValueChange={(value) => setBroadcastSegment(value as BroadcastSegment)}
                    >
                      <SelectTrigger id="broadcast-segment" className="bg-slate-900 border-slate-700">
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="all">All users (non-filtered)</SelectItem>
                        <SelectItem value="homeowners">Homeowners & residents</SelectItem>
                        <SelectItem value="contractors">Contractors & trades</SelectItem>
                        <SelectItem value="pros">All professionals (pros)</SelectItem>
                        <SelectItem value="admins">Platform admins only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">
                      Choose who should receive this announcement.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Delivery</Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-slate-100">In-app notification</p>
                          <p className="text-[11px] text-slate-400">Always on for broadcasts</p>
                        </div>
                        <Badge variant="outline" className="text-[11px] border-emerald-500 text-emerald-300">
                          Required
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-slate-100">Email (where allowed)</p>
                          <p className="text-[11px] text-slate-400">Respects user notification preferences</p>
                        </div>
                        <Switch
                          checked={broadcastEmail}
                          onCheckedChange={setBroadcastEmail}
                          aria-label="Toggle email delivery"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-slate-100">Push (where configured)</p>
                          <p className="text-[11px] text-slate-400">Requires valid push subscription</p>
                        </div>
                        <Switch
                          checked={broadcastPush}
                          onCheckedChange={setBroadcastPush}
                          aria-label="Toggle push delivery"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Guardrails</Label>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                      <li>Keep messages short and actionable.</li>
                      <li>Avoid PII; link users to dashboards or tools.</li>
                      <li>Use "admins" segment for internal alerts.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcast-title">Title</Label>
                  <Input
                    id="broadcast-title"
                    placeholder="Example: Scheduled maintenance tonight at 9pm"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcast-message">Message</Label>
                  <Textarea
                    id="broadcast-message"
                    rows={4}
                    placeholder="Write a concise announcement, including what is changing and where users should go."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="bg-slate-900 border-slate-700"
                  />
                  <p className="text-xs text-slate-400">
                    This text is sent as the body of the notification and may also be used for email or push content.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-campaign">Campaign type (optional)</Label>
                    <Input
                      id="broadcast-campaign"
                      placeholder="Example: trade_deal, marketplace_promo"
                      value={broadcastCampaignType}
                      onChange={(e) => setBroadcastCampaignType(e.target.value)}
                      className="bg-slate-900 border-slate-700"
                    />
                    <p className="text-xs text-slate-400">
                      Used for grouping and analytics (e.g. trade_deal, marketplace_promo).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="broadcast-tags">Tags (optional)</Label>
                    <Input
                      id="broadcast-tags"
                      placeholder="roofing, hvac, marketplace"
                      value={broadcastTags}
                      onChange={(e) => setBroadcastTags(e.target.value)}
                      className="bg-slate-900 border-slate-700"
                    />
                    <p className="text-xs text-slate-400">
                      Comma-separated tags that describe the promotion or category.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Targeting (optional)</Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="State code (e.g. TX)"
                        value={broadcastTargetState}
                        onChange={(e) => setBroadcastTargetState(e.target.value)}
                        className="bg-slate-900 border-slate-700"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-slate-100">Marketing opt-in only</p>
                          <p className="text-[11px] text-slate-400">
                            Respect users who allowed marketing emails in their preferences.
                          </p>
                        </div>
                        <Switch
                          checked={broadcastMarketingOnly}
                          onCheckedChange={setBroadcastMarketingOnly}
                          aria-label="Limit to marketing opt-in users"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-slate-400">
                    Scout can also trigger this broadcast as a tool call from chat; this panel is the manual override.
                  </p>
                  <Button
                    className="bg-orange-600 hover:bg-orange-700 whitespace-nowrap"
                    disabled={broadcastMutation.isPending || !broadcastTitle.trim() || !broadcastMessage.trim()}
                    onClick={() => broadcastMutation.mutate()}
                  >
                    {broadcastMutation.isPending ? "Sending broadcast..." : "Send broadcast"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="error-reports" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">User Error Reports</h2>
              <Button
                variant="outline"
                size="sm"
                className="border-navy-600 text-slate-200 hover:bg-navy-900/60"
                onClick={() => setLocation("/admin/error-reports")}
              >
                View full error report console
              </Button>
            </div>

            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle>Recent Error Reports</CardTitle>
                <CardDescription>User-submitted error reports and system issues</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-navy-600">
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Error Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-navy-600">
                      <TableCell colSpan={5} className="text-center text-navy-400 py-8">
                        Recent error report summary is available in the dedicated Error Reports console.
                        Use the button above to drill into full details, screenshots, and triage tools.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-fixes" className="space-y-6">
            <AICodeFixingDashboard />
          </TabsContent>

          <TabsContent value="llm-admin" className="space-y-6">
            <LLMAdminPanel />
          </TabsContent>

          <TabsContent value="authority" className="space-y-4">
            <AuthorityOperations />
          </TabsContent>

          <TabsContent value="pricing" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <Card className="bg-navy-700 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    Pricing Analytics & Calculator Updates
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    AI-powered pricing analysis and automatic calculator adjustments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-gray-300 mb-4">
                      Monitor market trends, track average job quotes, and automatically update calculator pricing based on real-world data.
                    </p>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={() => setLocation("/admin/pricing-analytics")}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Open Pricing Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-navy-700 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 text-sm">Active Trades</p>
                        <p className="text-2xl font-bold text-white">24</p>
                      </div>
                      <Wrench className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-navy-700 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 text-sm">Regions Tracked</p>
                        <p className="text-2xl font-bold text-white">156</p>
                      </div>
                      <MapPin className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-navy-700 border-navy-600">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 text-sm">Last Update</p>
                        <p className="text-2xl font-bold text-white">2h</p>
                      </div>
                      <Clock className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Finance / Invoicing Ledger</h2>
              <p className="text-xs text-slate-400 max-w-md">
                High-level view of all wallet movements across TradeScout. Use this as a starting point for
                reconciling partner payouts, marketplace sales, and affiliate commissions.
              </p>
            </div>

            <FinanceLedgerPanel />
          </TabsContent>
        </Tabs>

        {/* Edit/Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-slate-900 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit" : "Create"} {selectedTab === "contractor-settings" ? "Contractor Setting" : selectedTab === "ai-fixes" ? "AI Fix" : selectedTab.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </DialogTitle>
              <DialogDescription>
                {editingItem ? "Update the" : "Create a new"} {selectedTab === "contractor-settings" ? "contractor setting" : selectedTab === "ai-fixes" ? "AI fix" : selectedTab.replace("-", " ")} configuration.
              </DialogDescription>
            </DialogHeader>

            <AdminItemForm
              type={selectedTab}
              item={editingItem}
              onSubmit={handleSubmit}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function LLMAdminPanel() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadSummary, setUploadSummary] = useState<any>(null);
  const [infoInput, setInfoInput] = useState({ email: "", userId: "" });
  const [userInfo, setUserInfo] = useState<any>(null);
  const [resetInput, setResetInput] = useState({ email: "", userId: "", newPassword: "" });

  const uploadMutation = useMutation({
    mutationFn: async (selected: File[]) => {
      const allowedTypes = [
        "application/json",
        "text/markdown",
        "text/plain",
        "image/png",
        "image/jpeg",
        "image/webp",
      ];
      const maxSizeMb = 10;
      const filtered = selected.filter((f) => {
        const okType = allowedTypes.includes(f.type) || f.name.endsWith(".md") || f.name.endsWith(".json") || f.name.endsWith(".txt");
        const okSize = f.size <= maxSizeMb * 1024 * 1024;
        return okType && okSize;
      });
      if (!filtered.length) {
        throw new Error("No valid files. Allowed: json/md/txt/png/jpg/webp, max 10MB each.");
      }
      const formData = new FormData();
      filtered.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/admin/knowledge/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setUploadSummary(data.summary || null);
      toast({ title: "Upload complete", description: "Files sorted into knowledge cache" });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const userInfoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/users/info", {
        email: infoInput.email || undefined,
        userId: infoInput.userId || undefined,
      });
      return res;
    },
    onSuccess: (data) => {
      setUserInfo(data.user);
      toast({ title: "User loaded", description: data.user?.email });
    },
    onError: (error: any) => {
      toast({ title: "Lookup failed", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!resetInput.newPassword || resetInput.newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      const res = await apiRequest("POST", "/api/admin/users/reset-password", {
        email: resetInput.email || undefined,
        userId: resetInput.userId || undefined,
        newPassword: resetInput.newPassword,
      });
      return res;
    },
    onSuccess: (data) => {
      toast({ title: "Password reset", description: data.email || data.userId });
    },
    onError: (error: any) => {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    },
  });

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card
        className="border-slate-700"
        style={{ backgroundColor: "var(--surface-card)" }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Upload className="w-5 h-5 text-orange-500" /> Knowledge Upload</CardTitle>
          <CardDescription>Upload files (json, md, text, images). Backend will sort into overrides, county guides, or bulk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" multiple onChange={onFileChange} className="bg-slate-900 border-slate-700" />
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>{files.length} files selected</span>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700" disabled={uploadMutation.isPending || files.length === 0} onClick={() => uploadMutation.mutate(files)}>
              {uploadMutation.isPending ? "Uploading..." : "Upload & Ingest"}
            </Button>
          </div>
          {uploadSummary && (
            <div className="text-xs text-slate-200 space-y-1 bg-slate-900 p-3 rounded border border-slate-700">
              <div className="flex items-center gap-2 text-orange-300 font-semibold"><Info className="w-4 h-4" /> Ingest Summary</div>
              <div>Processed: {uploadSummary.processed}</div>
              <div>Overrides merged: {uploadSummary.overridesMerged}</div>
              <div>County files: {uploadSummary.countyFiles}</div>
              <div>Guides: {uploadSummary.guides}</div>
              <div>Bulk stored: {uploadSummary.bulkStored}</div>
              <div>Errors: {uploadSummary.errors?.length || 0}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card
        className="border-slate-700"
        style={{ backgroundColor: "var(--surface-card)" }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><KeyRound className="w-5 h-5 text-orange-500" /> User Lookup & Password Reset</CardTitle>
          <CardDescription>Super-admin tools: fetch user info and set a new password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-200">Email</Label>
              <Input value={infoInput.email} onChange={(e) => setInfoInput((p) => ({ ...p, email: e.target.value }))} placeholder="user@example.com" className="bg-slate-900 border-slate-700" />
            </div>
            <div>
              <Label className="text-slate-200">User ID</Label>
              <Input value={infoInput.userId} onChange={(e) => setInfoInput((p) => ({ ...p, userId: e.target.value }))} placeholder="uuid" className="bg-slate-900 border-slate-700" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => userInfoMutation.mutate()}
              disabled={userInfoMutation.isPending || (!infoInput.email && !infoInput.userId)}
            >
              {userInfoMutation.isPending ? "Loading..." : "Lookup User"}
            </Button>
          </div>
          {userInfo && (
            <div className="text-xs text-slate-200 bg-slate-900 p-3 rounded border border-slate-700 space-y-1">
              <div className="font-semibold">User</div>
              <div>ID: {userInfo.id}</div>
              <div>Email: {userInfo.email}</div>
              {userInfo.phone && (<div>Phone: {userInfo.phone}</div>)}
              <div>Name: {[userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || '—'}</div>
              <div>Location: {[userInfo.city, userInfo.county, userInfo.state, userInfo.zipCode].filter(Boolean).join(', ') || '—'}</div>
              <div>Roles: {(userInfo.roles || []).join(', ')}</div>
              <div>Active: {userInfo.activeRole}</div>
              <div>Verification: {userInfo.verificationStatus}</div>
              <div>Badges: {(userInfo.badges || []).join(', ')}</div>
            </div>
          )}

          <Separator className="bg-slate-800" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <Label className="text-slate-200">Email</Label>
              <Input value={resetInput.email} onChange={(e) => setResetInput((p) => ({ ...p, email: e.target.value }))} placeholder="user@example.com" className="bg-slate-900 border-slate-700" />
            </div>
            <div className="md:col-span-1">
              <Label className="text-slate-200">User ID</Label>
              <Input value={resetInput.userId} onChange={(e) => setResetInput((p) => ({ ...p, userId: e.target.value }))} placeholder="uuid" className="bg-slate-900 border-slate-700" />
            </div>
            <div className="md:col-span-1">
              <Label className="text-slate-200">New Password</Label>
              <Input type="password" value={resetInput.newPassword} onChange={(e) => setResetInput((p) => ({ ...p, newPassword: e.target.value }))} placeholder="min 8 chars" className="bg-slate-900 border-slate-700" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="bg-orange-600 hover:bg-orange-700" disabled={resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate()}>
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminItemForm({ type, item, onSubmit, onCancel }: {
  type: string;
  item: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(item || {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (type === "prizes") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Prize Name</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="$50 Home Depot Gift Card"
              required
            />
          </div>
          <div>
            <Label htmlFor="prizeType">Prize Type</Label>
            <Select value={formData.prizeType || undefined} onValueChange={(value) => updateField("prizeType", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gift_card">Gift Card</SelectItem>
                <SelectItem value="discount">Discount</SelectItem>
                <SelectItem value="premium_features">Premium Features</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Prize description..."
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              value={formData.value || ""}
              onChange={(e) => updateField("value", e.target.value)}
              placeholder="$50 or 25%"
              required
            />
          </div>
          <div>
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              value={formData.vendor || ""}
              onChange={(e) => updateField("vendor", e.target.value)}
              placeholder="Home Depot"
            />
          </div>
          <div>
            <Label htmlFor="probability">Probability (%)</Label>
            <Input
              id="probability"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.probability ? parseFloat(formData.probability) * 100 : 5}
              onChange={(e) => updateField("probability", (parseFloat(e.target.value) / 100).toString())}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expirationDays">Expiration (days)</Label>
            <Input
              id="expirationDays"
              type="number"
              value={formData.expirationDays || 30}
              onChange={(e) => updateField("expirationDays", parseInt(e.target.value))}
            />
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Switch
              id="isActive"
              checked={formData.isActive !== false}
              onCheckedChange={(checked) => updateField("isActive", checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </div>

        <div>
          <Label htmlFor="terms">Terms & Conditions</Label>
          <Textarea
            id="terms"
            value={formData.terms || ""}
            onChange={(e) => updateField("terms", e.target.value)}
            placeholder="Terms and conditions..."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
            {item ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    );
  }

  if (type === "advertisements") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Advertisement title"
            required
          />
        </div>

        <div>
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={formData.content || ""}
            onChange={(e) => updateField("content", e.target.value)}
            placeholder="Advertisement content..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl || ""}
              onChange={(e) => updateField("imageUrl", e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div>
            <Label htmlFor="linkUrl">Link URL</Label>
            <Input
              id="linkUrl"
              value={formData.linkUrl || ""}
              onChange={(e) => updateField("linkUrl", e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="placement">Placement</Label>
            <Select value={formData.placement || undefined} onValueChange={(value) => updateField("placement", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select placement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="banner">Banner</SelectItem>
                <SelectItem value="sidebar">Sidebar</SelectItem>
                <SelectItem value="popup">Popup</SelectItem>
                <SelectItem value="footer">Footer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Select value={formData.targetAudience || "all"} onValueChange={(value) => updateField("targetAudience", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="homeowners">Homeowners</SelectItem>
                <SelectItem value="contractors">Contractors</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate ? formData.startDate.split('T')[0] : ""}
              onChange={(e) => updateField("startDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate ? formData.endDate.split('T')[0] : ""}
              onChange={(e) => updateField("endDate", e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Switch
              id="isActive"
              checked={formData.isActive !== false}
              onCheckedChange={(checked) => updateField("isActive", checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
            {item ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    );
  }

  // Generic form for site settings and contractor settings
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category || ""}
            onChange={(e) => updateField("category", e.target.value)}
            placeholder="prizes, ads, features, etc."
            required
          />
        </div>
        <div>
          <Label htmlFor="key">Key {type === "contractor-settings" ? "(Setting)" : ""}</Label>
          <Input
            id="key"
            value={formData[type === "contractor-settings" ? "setting" : "key"] || ""}
            onChange={(e) => updateField(type === "contractor-settings" ? "setting" : "key", e.target.value)}
            placeholder="setting_name"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Setting description..."
        />
      </div>

      <div>
        <Label htmlFor="value">Value (JSON)</Label>
        <Textarea
          id="value"
          value={typeof formData.value === "string" ? formData.value : JSON.stringify(formData.value || {}, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              updateField("value", parsed);
            } catch {
              updateField("value", e.target.value);
            }
          }}
          placeholder='{"key": "value"}'
          className="font-mono"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive !== false}
          onCheckedChange={(checked) => updateField("isActive", checked)}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
          {item ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}