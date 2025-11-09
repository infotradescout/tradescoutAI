
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
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Settings</h1>
            <p className="text-xl text-gray-300">
              Manage your account preferences and privacy settings
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 bg-[#1a2332] border-[#2d3748]">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile">
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardHeader>
                  <CardTitle className="flex items-center text-orange-500">
                    <User className="w-5 h-5 mr-2" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-gray-300">First Name</Label>
                      <Input 
                        id="firstName" 
                        defaultValue={user?.firstName || ""}
                        className="bg-[#0f1419] border-[#2d3748] text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                      <Input 
                        id="lastName" 
                        defaultValue={user?.lastName || ""}
                        className="bg-[#0f1419] border-[#2d3748] text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email"
                      defaultValue={user?.email || ""}
                      className="bg-[#0f1419] border-[#2d3748] text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bio" className="text-gray-300">Bio</Label>
                    <Textarea 
                      id="bio"
                      placeholder="Tell us about yourself..."
                      className="bg-[#0f1419] border-[#2d3748] text-white"
                    />
                  </div>

                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Roles Management */}
            <TabsContent value="roles">
              <Card className="bg-[#1a2332] border-[#2d3748]">
                <CardHeader>
                  <CardTitle className="flex items-center text-orange-500">
                    <Briefcase className="w-5 h-5 mr-2" />
                    Manage Your Roles
                  </CardTitle>
                  <p className="text-slate-300 text-sm mt-2">
                    Select all the roles that apply to you. Your dashboard and experience will automatically adapt.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current Roles Summary */}
                  <div className="bg-[#0f1419] border border-[#2d3748] rounded-lg p-4">
                    <h3 className="text-white font-medium mb-3">Currently Active Roles</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoles.length > 0 ? (
                        selectedRoles.map((roleKey) => {
                          const config = ROLE_CONFIG[roleKey as keyof typeof ROLE_CONFIG];
                          if (!config) return null;
                          return (
                            <Badge key={roleKey} className="bg-orange-500 text-white">
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
                    <h3 className="text-white font-medium mb-4">Available Roles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => {
                        const Icon = config.icon;
                        const isSelected = selectedRoles.includes(roleKey);
                        return (
                          <div
                            key={roleKey}
                            onClick={() => toggleRole(roleKey)}
                            className={`
                              relative p-4 rounded-lg border-2 cursor-pointer transition-all
                              ${isSelected 
                                ? 'bg-orange-500/20 border-orange-500' 
                                : 'bg-[#0f1419] border-[#2d3748] hover:border-orange-500/50'
                              }
                            `}
                            data-testid={`role-option-${roleKey}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${isSelected ? 'bg-orange-500' : 'bg-[#2d3748]'}`}>
                                <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-orange-500'}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-white">{config.label}</h4>
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-orange-500" />
                                  )}
                                </div>
                                <p className="text-sm text-slate-300">{config.desc}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#2d3748]">
                    <p className="text-sm text-slate-300">
                      {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''} selected
                    </p>
                    <Button 
                      onClick={saveRoles}
                      disabled={updateRolesMutation.isPending || selectedRoles.length === 0}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      data-testid="button-save-roles"
                    >
                      {updateRolesMutation.isPending ? 'Saving...' : 'Save Roles'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications">
              <Card className="bg-navy-800 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Bell className="w-5 h-5 text-orange-500 mr-2" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries({
                    email: { icon: Mail, label: "Email Notifications", desc: "Receive updates via email" },
                    sms: { icon: Smartphone, label: "SMS Notifications", desc: "Get text message alerts" },
                    push: { icon: Bell, label: "Push Notifications", desc: "Browser and app notifications" },
                    marketing: { icon: Globe, label: "Marketing Communications", desc: "Updates about new features and offers" }
                  }).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="text-white font-medium">{config.label}</p>
                            <p className="text-gray-400 text-sm">{config.desc}</p>
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
              <Card className="bg-navy-800 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Eye className="w-5 h-5 text-orange-500 mr-2" />
                    Privacy Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Profile Visibility</p>
                      <p className="text-gray-400 text-sm">Make your profile visible to other users</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Show in Search Results</p>
                      <p className="text-gray-400 text-sm">Allow others to find you through search</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div>
                    <Label className="text-gray-300">Who can contact you?</Label>
                    <Select defaultValue="verified">
                      <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-navy-700 border-navy-600">
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
              <Card className="bg-navy-800 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Shield className="w-5 h-5 text-orange-500 mr-2" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-white font-medium mb-4">Change Password</h3>
                    <div className="space-y-3">
                      <Input 
                        type="password" 
                        placeholder="Current password"
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                      <Input 
                        type="password" 
                        placeholder="New password"
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                      <Input 
                        type="password" 
                        placeholder="Confirm new password"
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                      <Button variant="outline" className="border-orange-500 text-orange-500">
                        Update Password
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Two-Factor Authentication</p>
                      <p className="text-gray-400 text-sm">Add an extra layer of security</p>
                    </div>
                    <Button variant="outline" className="border-orange-500 text-orange-500">
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
