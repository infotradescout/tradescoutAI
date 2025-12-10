
import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Globe,
  Smartphone,
  Mail,
  Lock,
  Eye,
  CreditCard,
  Briefcase,
  Home,
  Wrench,
  Car,
  Building,
  Users,
  Heart,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { PRESET_THEMES } from "@/lib/themes";

// Theme Selector Component
function ThemeSelector() {
  const { currentTheme, setTheme } = useTheme();
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-medium mb-4">Select a Theme</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRESET_THEMES.map((theme) => {
            const isSelected = currentTheme.id === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                className={`
                  relative p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${isSelected 
                    ? 'border-orange-500 bg-orange-500/10' 
                    : 'border-[#2d3748] bg-[#0f1419] hover:border-orange-500/50'
                  }
                `}
                data-testid={`theme-${theme.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white mb-1">{theme.name}</h4>
                    <p className="text-sm text-slate-300">{theme.description}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  )}
                </div>
                
                {/* Color Preview */}
                <div className="flex gap-2 mt-3">
                  <div 
                    className="w-8 h-8 rounded border border-white/20"
                    style={{ backgroundColor: theme.colors.bgPrimary }}
                  />
                  <div 
                    className="w-8 h-8 rounded border border-white/20"
                    style={{ backgroundColor: theme.colors.bgSecondary }}
                  />
                  <div 
                    className="w-8 h-8 rounded border border-white/20"
                    style={{ backgroundColor: theme.colors.accentPrimary }}
                  />
                  <div 
                    className="w-8 h-8 rounded border border-white/20"
                    style={{ backgroundColor: theme.colors.accentSecondary }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-[#0f1419] border border-[#2d3748] rounded-lg">
        <p className="text-sm text-slate-300">
          <strong className="text-white">Current Theme:</strong> {currentTheme.name}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Your theme choice is saved automatically and will apply across your entire experience.
        </p>
      </div>
    </div>
  );
}

// Role configurations
const ROLE_CONFIG = {
  homeowner: { label: "Homeowner", icon: Home, desc: "Manage your home and projects", color: "blue" },
  contractor_user: { label: "Contractor", icon: Wrench, desc: "Provide construction services", color: "orange" },
  realtor: { label: "Realtor", icon: Building, desc: "Real estate professional", color: "purple" },
  car_salesman: { label: "Car Salesman", icon: Car, desc: "Automotive sales professional", color: "red" },
  insurance_agent: { label: "Insurance Agent", icon: Shield, desc: "Insurance services provider", color: "green" },
  mortgage_broker: { label: "Mortgage Broker", icon: CreditCard, desc: "Mortgage and lending expert", color: "indigo" },
  property_manager: { label: "Property Manager", icon: Building, desc: "Manage rental properties", color: "teal" },
  business_owner: { label: "Business Owner", icon: Briefcase, desc: "Local business owner", color: "amber" },
  helper: { label: "Helper/Worker", icon: Heart, desc: "Provide labor and assistance", color: "pink" },
  vehicle_dealer: { label: "Vehicle Dealer", icon: Car, desc: "Vehicle sales and services", color: "cyan" },
  hoa_admin: { label: "HOA Admin", icon: Users, desc: "HOA management", color: "violet" }
};

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    marketing: false
  });

  // Get user's current roles
  const userRoles = user?.roles || [user?.role].filter(Boolean);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(userRoles);

  // Update roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      return apiRequest('PATCH', '/api/user/roles', { roles });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Roles Updated!",
        description: "Your account roles have been updated. Your dashboard will refresh automatically.",
      });
      // Reload to update dashboard
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update roles. Please try again.",
        variant: "destructive",
      });
    }
  });

  const toggleRole = (roleKey: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleKey)) {
        // Don't allow removing all roles
        if (prev.length === 1) {
          toast({
            title: "Cannot Remove",
            description: "You must have at least one role.",
            variant: "destructive",
          });
          return prev;
        }
        return prev.filter(r => r !== roleKey);
      } else {
        return [...prev, roleKey];
      }
    });
  };

  const saveRoles = () => {
    if (selectedRoles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one role.",
        variant: "destructive",
      });
      return;
    }
    updateRolesMutation.mutate(selectedRoles);
  };

  return (
    <div className="min-h-screen bg-[#0f1419] pb-20 lg:pb-0">
      <div className="container mx-auto px-4 py-6 lg:py-10">
        <div className="max-w-5xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8">
          {/* Modern Header */}
          <div className="mb-8 lg:mb-12">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-5xl font-bold text-white mb-1">Settings</h1>
                <p className="text-lg text-slate-400">
                  Manage your account preferences and privacy
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="w-full bg-[#1a2332] border border-[#2d3748] p-1.5 rounded-xl shadow-lg overflow-x-auto flex lg:grid lg:grid-cols-6">
              <TabsTrigger value="profile" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all rounded-lg">
                Profile
              </TabsTrigger>
              <TabsTrigger value="roles" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all rounded-lg">
                Roles
              </TabsTrigger>
              <TabsTrigger value="appearance" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all rounded-lg">
                Appearance
              </TabsTrigger>
              <TabsTrigger value="notifications" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all rounded-lg">
                Notifications
              </TabsTrigger>
              <TabsTrigger value="privacy" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all rounded-lg">
                Privacy
              </TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all rounded-lg">
                Security
              </TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile">
              <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
                <CardHeader className="border-b border-[#2d3748] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Profile Information</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">Update your personal details and profile</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  {/* Profile Photo Section */}
                  <div className="flex items-center gap-6 pb-6 border-b border-[#2d3748]">
                    <div className="h-20 w-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Profile Photo</h3>
                      <p className="text-sm text-slate-400 mb-3">Update your profile picture</p>
                      <Button size="sm" variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                        Upload Photo
                      </Button>
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-white font-medium">First Name</Label>
                      <Input 
                        id="firstName" 
                        defaultValue={user?.firstName || ""}
                        className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-white font-medium">Last Name</Label>
                      <Input 
                        id="lastName" 
                        defaultValue={user?.lastName || ""}
                        className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-orange-500" />
                      Email Address
                    </Label>
                    <Input 
                      id="email" 
                      type="email"
                      defaultValue={user?.email || ""}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="email@example.com"
                    />
                    <p className="text-xs text-slate-400">We'll never share your email with anyone</p>
                  </div>

                  {/* Bio Field */}
                  <div className="space-y-2">
                    <Label htmlFor="bio" className="text-white font-medium">Bio</Label>
                    <Textarea 
                      id="bio"
                      placeholder="Tell us about yourself..."
                      className="bg-[#0f1419] border-[#2d3748] text-white min-h-[120px] focus:border-orange-500 transition-colors resize-none"
                      rows={5}
                    />
                    <p className="text-xs text-slate-400">Brief description for your profile. Maximum 500 characters.</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-[#2d3748]">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 shadow-lg">
                      Save Changes
                    </Button>
                    <Button variant="outline" className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Roles Management */}
            <TabsContent value="roles">
              <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
                <CardHeader className="border-b border-[#2d3748] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Manage Your Roles</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">
                        Select all the roles that apply to you. Your dashboard and experience will automatically adapt.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  {/* Current Roles Summary */}
                  <div className="bg-gradient-to-br from-[#0f1419] to-[#1a2332] border border-[#2d3748] rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="h-5 w-5 text-orange-500" />
                      <h3 className="text-white font-semibold text-lg">Currently Active Roles</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoles.length > 0 ? (
                        selectedRoles.map((roleKey) => {
                          const config = ROLE_CONFIG[roleKey as keyof typeof ROLE_CONFIG];
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <Badge key={roleKey} className="bg-orange-500 text-white px-3 py-1.5 text-sm font-medium flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5" />
                              {config.label}
                            </Badge>
                          );
                        })
                      ) : (
                        <p className="text-slate-400 text-sm">No roles selected</p>
                      )}
                    </div>
                  </div>

                  {/* Available Roles */}
                  <div>
                    <h3 className="text-white font-semibold text-lg mb-5">Available Roles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
                        const Icon = config.icon;
                        const isSelected = selectedRoles.includes(roleKey);
                        return (
                          <div
                            key={roleKey}
                            onClick={() => toggleRole(roleKey)}
                            className={`
                              relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg
                              ${isSelected 
                                ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500 shadow-orange-500/20' 
                                : 'bg-[#0f1419] border-[#2d3748] hover:border-orange-500/50 hover:bg-[#1a2332]/50'
                              }
                            `}
                            data-testid={`role-option-${roleKey}`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-xl transition-all ${isSelected ? 'bg-orange-500 shadow-lg' : 'bg-[#2d3748]'}`}>
                                <Icon className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-orange-500'}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <h4 className="font-semibold text-white text-base">{config.label}</h4>
                                  {isSelected && (
                                    <CheckCircle2 className="h-5 w-5 text-orange-500" />
                                  )}
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">{config.desc}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-[#2d3748]">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-orange-500 font-bold text-sm">{selectedRoles.length}</span>
                      </div>
                      <p className="text-sm text-slate-300">
                        role{selectedRoles.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                    <Button 
                      onClick={saveRoles}
                      disabled={updateRolesMutation.isPending || selectedRoles.length === 0}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-8 shadow-lg disabled:opacity-50"
                      data-testid="button-save-roles"
                    >
                      {updateRolesMutation.isPending ? 'Saving...' : 'Save Roles'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance">
              <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
                <CardHeader className="border-b border-[#2d3748] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Palette className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Theme & Appearance</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">
                        Customize your color scheme and visual preferences
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <ThemeSelector />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications">
              <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
                <CardHeader className="border-b border-[#2d3748] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Notification Preferences</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">
                        Choose how you want to receive updates and alerts
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {Object.entries({
                    email: { icon: Mail, label: "Email Notifications", desc: "Receive updates via email" },
                    sms: { icon: Smartphone, label: "SMS Notifications", desc: "Get text message alerts" },
                    push: { icon: Bell, label: "Push Notifications", desc: "Browser and app notifications" },
                    marketing: { icon: Globe, label: "Marketing Communications", desc: "Updates about new features and offers" }
                  }).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex items-center justify-between p-4 bg-[#0f1419] rounded-xl border border-[#2d3748] hover:border-orange-500/30 transition-all">
                        <div className="flex items-center space-x-4">
                          <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{config.label}</p>
                            <p className="text-slate-400 text-sm">{config.desc}</p>
                          </div>
                        </div>
                        <Switch 
                          checked={notifications[key as keyof typeof notifications]}
                          onCheckedChange={(checked) => 
                            setNotifications(prev => ({ ...prev, [key]: checked }))
                          }
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Settings */}
            <TabsContent value="privacy">
              <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
                <CardHeader className="border-b border-[#2d3748] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Eye className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Privacy Settings</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">
                        Control who can see your information and contact you
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="flex items-center justify-between p-4 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Profile Visibility</p>
                        <p className="text-slate-400 text-sm">Make your profile visible to other users</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Globe className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Show in Search Results</p>
                        <p className="text-slate-400 text-sm">Allow others to find you through search</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="space-y-3 p-4 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <Label className="text-white font-medium">Who can contact you?</Label>
                        <p className="text-slate-400 text-sm">Choose who can send you messages</p>
                      </div>
                    </div>
                    <Select defaultValue="verified">
                      <SelectTrigger className="bg-[#1a2332] border-[#2d3748] text-white h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2332] border-[#2d3748]">
                        <SelectItem value="everyone">Everyone</SelectItem>
                        <SelectItem value="verified">Verified users only</SelectItem>
                        <SelectItem value="contractors">Contractors only</SelectItem>
                        <SelectItem value="none">No one</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security">
              <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
                <CardHeader className="border-b border-[#2d3748] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Security Settings</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">
                        Manage your password and account security
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="p-6 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Lock className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Change Password</h3>
                        <p className="text-sm text-slate-400">Update your account password</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Current Password</Label>
                        <Input 
                          type="password" 
                          placeholder="Enter current password"
                          className="bg-[#1a2332] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium">New Password</Label>
                        <Input 
                          type="password" 
                          placeholder="Enter new password"
                          className="bg-[#1a2332] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Confirm New Password</Label>
                        <Input 
                          type="password" 
                          placeholder="Confirm new password"
                          className="bg-[#1a2332] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                        />
                      </div>
                      <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full mt-2 shadow-lg">
                        Update Password
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">Two-Factor Authentication</p>
                        <p className="text-slate-400 text-sm">Add an extra layer of security to your account</p>
                      </div>
                    </div>
                    <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-6">
                      Enable 2FA
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  );
}
