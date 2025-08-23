import { memo, useState } from 'react';
import { Settings2, Save, Shield, Bell, Globe, Database, Users2, Mail, Server, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const SystemSettings = memo(function SystemSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const { toast } = useToast();

  // General Settings State
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "TradeScout",
    siteDescription: "Professional contractor and homeowner platform",
    maintenanceMode: false,
    registrationEnabled: true,
    emailVerificationRequired: true,
    addressVerificationRequired: true
  });

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState({
    passwordMinLength: 8,
    requireTwoFactor: false,
    sessionTimeout: 24,
    maxLoginAttempts: 5,
    rateLimitEnabled: true,
    ipWhitelistEnabled: false
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    adminAlerts: true,
    systemAlerts: true,
    userReports: true
  });

  const handleSaveSettings = (settingsType: string) => {
    toast({
      title: "Settings Saved",
      description: `${settingsType} settings have been updated successfully.`,
    });
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Settings2 className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">System Settings</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Configure platform settings and system preferences
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-navy-800 border-navy-600">
            <TabsTrigger value="general" className="data-[state=active]:bg-orange-600">
              <Globe className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-orange-600">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-orange-600">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="database" className="data-[state=active]:bg-orange-600">
              <Database className="h-4 w-4 mr-2" />
              Database
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-orange-600">
              <Server className="h-4 w-4 mr-2" />
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  General Platform Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="siteName" className="text-white">Site Name</Label>
                    <Input
                      id="siteName"
                      value={generalSettings.siteName}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, siteName: e.target.value }))}
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="siteDescription" className="text-white">Site Description</Label>
                    <Input
                      id="siteDescription"
                      value={generalSettings.siteDescription}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, siteDescription: e.target.value }))}
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Maintenance Mode</Label>
                      <p className="text-gray-400 text-sm">Temporarily disable public access</p>
                    </div>
                    <Switch
                      checked={generalSettings.maintenanceMode}
                      onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, maintenanceMode: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">User Registration</Label>
                      <p className="text-gray-400 text-sm">Allow new user signups</p>
                    </div>
                    <Switch
                      checked={generalSettings.registrationEnabled}
                      onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, registrationEnabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Email Verification Required</Label>
                      <p className="text-gray-400 text-sm">Require email verification for new accounts</p>
                    </div>
                    <Switch
                      checked={generalSettings.emailVerificationRequired}
                      onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, emailVerificationRequired: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Address Verification Required</Label>
                      <p className="text-gray-400 text-sm">Require address verification within 14 days</p>
                    </div>
                    <Switch
                      checked={generalSettings.addressVerificationRequired}
                      onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, addressVerificationRequired: checked }))}
                    />
                  </div>
                </div>

                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => handleSaveSettings("General")}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save General Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Authentication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="passwordLength" className="text-white">Minimum Password Length</Label>
                    <Input
                      id="passwordLength"
                      type="number"
                      value={securitySettings.passwordMinLength}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, passwordMinLength: parseInt(e.target.value) }))}
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout" className="text-white">Session Timeout (hours)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxLoginAttempts" className="text-white">Max Login Attempts</Label>
                    <Input
                      id="maxLoginAttempts"
                      type="number"
                      value={securitySettings.maxLoginAttempts}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, maxLoginAttempts: parseInt(e.target.value) }))}
                      className="bg-navy-700 border-navy-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Two-Factor Authentication</Label>
                      <p className="text-gray-400 text-sm">Require 2FA for admin accounts</p>
                    </div>
                    <Switch
                      checked={securitySettings.requireTwoFactor}
                      onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, requireTwoFactor: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Rate Limiting</Label>
                      <p className="text-gray-400 text-sm">Enable API rate limiting</p>
                    </div>
                    <Switch
                      checked={securitySettings.rateLimitEnabled}
                      onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, rateLimitEnabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">IP Whitelist</Label>
                      <p className="text-gray-400 text-sm">Restrict admin access to specific IPs</p>
                    </div>
                    <Switch
                      checked={securitySettings.ipWhitelistEnabled}
                      onCheckedChange={(checked) => setSecuritySettings(prev => ({ ...prev, ipWhitelistEnabled: checked }))}
                    />
                  </div>
                </div>

                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => handleSaveSettings("Security")}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Email Notifications</Label>
                      <p className="text-gray-400 text-sm">Send email notifications to users</p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">SMS Notifications</Label>
                      <p className="text-gray-400 text-sm">Send SMS notifications for urgent updates</p>
                    </div>
                    <Switch
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, smsNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Push Notifications</Label>
                      <p className="text-gray-400 text-sm">Send browser push notifications</p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, pushNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">Admin Alerts</Label>
                      <p className="text-gray-400 text-sm">Send alerts to administrators</p>
                    </div>
                    <Switch
                      checked={notificationSettings.adminAlerts}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, adminAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">System Alerts</Label>
                      <p className="text-gray-400 text-sm">System status and error notifications</p>
                    </div>
                    <Switch
                      checked={notificationSettings.systemAlerts}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, systemAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <Label className="text-white">User Reports</Label>
                      <p className="text-gray-400 text-sm">Notifications for user reports and issues</p>
                    </div>
                    <Switch
                      checked={notificationSettings.userReports}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, userReports: checked }))}
                    />
                  </div>
                </div>

                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => handleSaveSettings("Notification")}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-navy-700 border-navy-600">
                    <CardContent className="p-6 text-center">
                      <Database className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                      <div className="text-2xl font-bold text-white mb-1">847,293</div>
                      <div className="text-gray-400 text-sm">Total Records</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-navy-700 border-navy-600">
                    <CardContent className="p-6 text-center">
                      <Users2 className="h-8 w-8 text-green-400 mx-auto mb-3" />
                      <div className="text-2xl font-bold text-white mb-1">12,847</div>
                      <div className="text-gray-400 text-sm">Active Users</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-navy-700 border-navy-600">
                    <CardContent className="p-6 text-center">
                      <Server className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                      <div className="text-2xl font-bold text-white mb-1">2.3 GB</div>
                      <div className="text-gray-400 text-sm">Database Size</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <Database className="h-4 w-4 mr-2" />
                    Create Database Backup
                  </Button>
                  
                  <Button variant="outline" className="w-full border-orange-600 text-orange-400 hover:bg-orange-600/20">
                    <Server className="h-4 w-4 mr-2" />
                    Optimize Database
                  </Button>

                  <Button variant="outline" className="w-full border-gray-600 text-gray-400 hover:bg-gray-600/20">
                    <Database className="h-4 w-4 mr-2" />
                    View Database Logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Third-Party Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 bg-navy-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-white">Email Service Provider</Label>
                      <span className="text-green-400">Connected</span>
                    </div>
                    <Select defaultValue="sendgrid">
                      <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="mailgun">Mailgun</SelectItem>
                        <SelectItem value="ses">AWS SES</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 bg-navy-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-white">SMS Provider</Label>
                      <span className="text-yellow-400">Disconnected</span>
                    </div>
                    <Select defaultValue="twilio">
                      <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="nexmo">Nexmo</SelectItem>
                        <SelectItem value="aws-sns">AWS SNS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 bg-navy-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-white">Payment Processor</Label>
                      <span className="text-green-400">Connected</span>
                    </div>
                    <Select defaultValue="stripe">
                      <SelectTrigger className="bg-navy-600 border-navy-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => handleSaveSettings("Integration")}
                >
                  <Server className="h-4 w-4 mr-2" />
                  Save Integration Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default SystemSettings;