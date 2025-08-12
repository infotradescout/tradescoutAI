import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UIMonitoringDashboard } from "@/components/admin/UIMonitoringDashboard";
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
import { Plus, Edit, Trash2, Gift, Settings, Megaphone, Users, Bell, Map, CheckCircle, Bug, Image, BarChart3, DollarSign, Wrench, MapPin, Clock } from "lucide-react";
import { useLocation } from "wouter";



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

  // Check admin access
  if (!isAuthenticated || !user || !['owner', 'ops_admin'].includes(user.role || '')) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
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
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="w-8 h-8 text-orange-500" />
            Admin Panel
          </h1>
          <p className="text-gray-400">Manage site features, prizes, advertisements, contractor settings, and AI monitoring</p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 bg-slate-800">
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
            <TabsTrigger value="error-reports" className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Error Reports
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Pricing Analytics
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
                          <div className="text-xs text-gray-400 font-mono bg-slate-800 p-2 rounded">
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
                          <div className="text-xs text-gray-400 font-mono bg-slate-800 p-2 rounded">
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

          <TabsContent value="error-reports" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">User Error Reports</h2>
            </div>
            {/* TODO: Add error reports table */}
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <div className="space-y-6">
              <Card className="bg-navy-700 border-navy-600">
                <CardHeader>
                  <CardTitle className="text-white">Pricing Analytics Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
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
        </Tabs>

        {/* Edit/Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-slate-900 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit" : "Create"} {selectedTab === "contractor-settings" ? "Contractor Setting" : selectedTab.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </DialogTitle>
              <DialogDescription>
                {editingItem ? "Update the" : "Create a new"} {selectedTab === "contractor-settings" ? "contractor setting" : selectedTab.replace("-", " ")} configuration.
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