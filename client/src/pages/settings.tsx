
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  CreditCard
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    marketing: false
  });

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
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 bg-navy-800">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile">
              <Card className="bg-navy-800 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <User className="w-5 h-5 text-orange-500 mr-2" />
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
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                      <Input 
                        id="lastName" 
                        defaultValue={user?.lastName || ""}
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email"
                      defaultValue={user?.email || ""}
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bio" className="text-gray-300">Bio</Label>
                    <Textarea 
                      id="bio"
                      placeholder="Tell us about yourself..."
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>

                  <Button className="bg-orange-500 hover:bg-orange-600">
                    Save Changes
                  </Button>
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

            {/* Billing Settings */}
            <TabsContent value="billing">
              <Card className="bg-navy-800 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <CreditCard className="w-5 h-5 text-orange-500 mr-2" />
                    Billing & Subscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-8">
                    <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-white font-medium mb-2">No active subscriptions</h3>
                    <p className="text-gray-400">You're currently on our free plan</p>
                    <Button className="bg-orange-500 hover:bg-orange-600 mt-4">
                      Upgrade to Pro
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
