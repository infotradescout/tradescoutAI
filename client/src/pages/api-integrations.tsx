import { memo, useState } from 'react';
import { Code, Globe, Key, Settings, CheckCircle, XCircle, Clock, AlertTriangle, Copy, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const APIIntegrations = memo(function APIIntegrations() {
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();

  const integrations = [
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment processing for escrow and subscriptions',
      status: 'connected',
      lastSync: '5 minutes ago',
      apiVersion: 'v2023-08-16',
      enabled: true,
      logo: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=40&h=40&fit=crop',
      endpoints: ['payments', 'subscriptions', 'escrow'],
      requests: 15420,
      errors: 12
    },
    {
      id: 'facebook',
      name: 'Facebook Graph API',
      description: 'Social login and page integration',
      status: 'connected',
      lastSync: '2 hours ago',
      apiVersion: 'v18.0',
      enabled: true,
      logo: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=40&h=40&fit=crop',
      endpoints: ['auth', 'pages', 'posts'],
      requests: 8934,
      errors: 3
    },
    {
      id: 'google-maps',
      name: 'Google Maps Platform',
      description: 'Location services and geocoding',
      status: 'connected',
      lastSync: '1 hour ago',
      apiVersion: 'v3',
      enabled: true,
      logo: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=40&h=40&fit=crop',
      endpoints: ['geocoding', 'places', 'directions'],
      requests: 23567,
      errors: 0
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Email delivery and notifications',
      status: 'connected',
      lastSync: '30 minutes ago',
      apiVersion: 'v3',
      enabled: true,
      logo: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=40&h=40&fit=crop',
      endpoints: ['mail', 'templates', 'lists'],
      requests: 5634,
      errors: 1
    },
    {
      id: 'twilio',
      name: 'Twilio',
      description: 'SMS notifications and phone verification',
      status: 'error',
      lastSync: '6 hours ago',
      apiVersion: 'v2010-04-01',
      enabled: false,
      logo: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=40&h=40&fit=crop',
      endpoints: ['sms', 'verify', 'voice'],
      requests: 1234,
      errors: 45
    },
    {
      id: 'aws-s3',
      name: 'Amazon S3',
      description: 'File storage and document management',
      status: 'pending',
      lastSync: 'Never',
      apiVersion: 'v4',
      enabled: false,
      logo: 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=40&h=40&fit=crop',
      endpoints: ['storage', 'cdn', 'backup'],
      requests: 0,
      errors: 0
    }
  ];

  const webhooks = [
    {
      id: 1,
      name: 'Payment Completed',
      url: 'https://api.tradescout.com/webhooks/payment-completed',
      events: ['payment.succeeded', 'payment.failed'],
      status: 'active',
      lastTrigger: '2 hours ago',
      attempts: 1247,
      failures: 3
    },
    {
      id: 2,
      name: 'User Registration',
      url: 'https://api.tradescout.com/webhooks/user-registered',
      events: ['user.created', 'user.verified'],
      status: 'active',
      lastTrigger: '1 hour ago',
      attempts: 567,
      failures: 0
    },
    {
      id: 3,
      name: 'Project Updates',
      url: 'https://api.tradescout.com/webhooks/project-updates',
      events: ['project.created', 'project.completed'],
      status: 'paused',
      lastTrigger: '1 day ago',
      attempts: 234,
      failures: 12
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-600 hover:bg-green-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'pending':
        return 'bg-yellow-600 hover:bg-yellow-700';
      default:
        return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "API key copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Code className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">API & Integrations</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Manage third-party integrations and API configurations
          </p>
        </div>

        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-navy-800/50 backdrop-blur-sm">
            <TabsTrigger value="integrations" className="data-[state=active]:bg-orange-600">Integrations</TabsTrigger>
            <TabsTrigger value="api-keys" className="data-[state=active]:bg-orange-600">API Keys</TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-orange-600">Webhooks</TabsTrigger>
            <TabsTrigger value="docs" className="data-[state=active]:bg-orange-600">Documentation</TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integrations.map((integration) => (
                <Card key={integration.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={integration.logo}
                          alt={integration.name}
                          className="w-10 h-10 rounded-lg"
                        />
                        <div>
                          <CardTitle className="text-white">{integration.name}</CardTitle>
                          <p className="text-gray-400 text-sm">{integration.description}</p>
                        </div>
                      </div>
                      <Switch checked={integration.enabled} />
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(integration.status)}
                          <Badge className={getStatusColor(integration.status)}>
                            {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                          </Badge>
                        </div>
                        <span className="text-gray-400 text-sm">{integration.apiVersion}</span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Last sync:</span>
                          <span className="text-white">{integration.lastSync}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Requests:</span>
                          <span className="text-white">{integration.requests.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Errors:</span>
                          <span className={integration.errors > 0 ? "text-red-400" : "text-green-400"}>
                            {integration.errors}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-gray-400 text-sm mb-2">Endpoints:</p>
                        <div className="flex flex-wrap gap-1">
                          {integration.endpoints.map((endpoint, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {endpoint}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-orange-600 hover:bg-orange-700"
                          disabled={integration.status === 'pending'}
                        >
                          {integration.status === 'connected' ? 'Configure' : 
                           integration.status === 'error' ? 'Reconnect' : 'Connect'}
                        </Button>
                        <Button size="sm" variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="api-keys" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    TradeScout API Keys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <label className="text-white text-sm mb-2 block">Production API Key</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value="ts_prod_1234567890abcdef"
                          readOnly
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard("ts_prod_1234567890abcdef")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">Created: March 1, 2024 • Last used: 5 minutes ago</p>
                    </div>

                    <div>
                      <label className="text-white text-sm mb-2 block">Test API Key</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="password"
                          value="ts_test_0987654321fedcba"
                          readOnly
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard("ts_test_0987654321fedcba")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">Created: March 1, 2024 • Last used: 2 hours ago</p>
                    </div>

                    <div className="space-y-3">
                      <Button className="w-full bg-orange-600 hover:bg-orange-700">
                        Generate New API Key
                      </Button>
                      <Button variant="outline" className="w-full border-orange-600 text-orange-400 hover:bg-orange-600/20">
                        Rotate Keys
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">API Usage Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-400 mb-2">47,823</div>
                      <div className="text-gray-400">Total API Calls This Month</div>
                      <div className="text-green-400 text-sm">+23% from last month</div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-navy-700/50 rounded-lg">
                        <span className="text-white">Authentication</span>
                        <span className="text-orange-400">18,456</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-navy-700/50 rounded-lg">
                        <span className="text-white">User Management</span>
                        <span className="text-blue-400">12,234</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-navy-700/50 rounded-lg">
                        <span className="text-white">Marketplace</span>
                        <span className="text-green-400">9,567</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-navy-700/50 rounded-lg">
                        <span className="text-white">Notifications</span>
                        <span className="text-purple-400">7,566</span>
                      </div>
                    </div>

                    <div className="bg-navy-700/50 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">Rate Limits</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Current usage:</span>
                          <span className="text-white">1,547 / 10,000 per hour</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Burst limit:</span>
                          <span className="text-white">247 / 1,000 per minute</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <div className="space-y-6">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-white">Webhook Endpoints</CardTitle>
                    <Button className="bg-orange-600 hover:bg-orange-700">
                      Add Webhook
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {webhooks.map((webhook) => (
                      <div key={webhook.id} className="p-4 bg-navy-700/50 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-white font-medium">{webhook.name}</h4>
                            <p className="text-gray-400 text-sm">{webhook.url}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={webhook.status === 'active' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}>
                              {webhook.status}
                            </Badge>
                            <Switch checked={webhook.status === 'active'} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Events:</span>
                            <div className="mt-1">
                              {webhook.events.map((event, index) => (
                                <Badge key={index} variant="outline" className="text-xs mr-1">
                                  {event}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-400">Last trigger:</span>
                            <p className="text-white">{webhook.lastTrigger}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Attempts:</span>
                            <p className="text-white">{webhook.attempts}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Failures:</span>
                            <p className={webhook.failures > 0 ? "text-red-400" : "text-green-400"}>
                              {webhook.failures}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                            Test
                          </Button>
                          <Button size="sm" variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/20">
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    API Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { title: "Getting Started", description: "Authentication and basic setup", url: "/docs/getting-started" },
                      { title: "User Management", description: "User CRUD operations and profiles", url: "/docs/users" },
                      { title: "Marketplace API", description: "Listings, orders, and transactions", url: "/docs/marketplace" },
                      { title: "Notifications", description: "Email, SMS, and push notifications", url: "/docs/notifications" },
                      { title: "Webhooks", description: "Event-driven integrations", url: "/docs/webhooks" },
                      { title: "Rate Limits", description: "API quotas and best practices", url: "/docs/rate-limits" }
                    ].map((doc, index) => (
                      <div key={index} className="p-3 bg-navy-700/50 rounded-lg hover:bg-navy-600/50 transition-colors cursor-pointer">
                        <h4 className="text-white font-medium">{doc.title}</h4>
                        <p className="text-gray-400 text-sm">{doc.description}</p>
                      </div>
                    ))}
                  </div>

                  <Button className="w-full mt-6 bg-orange-600 hover:bg-orange-700">
                    View Full Documentation
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Code Examples</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-navy-900/50 rounded-lg p-4">
                      <h4 className="text-orange-400 font-medium mb-2">Authentication</h4>
                      <pre className="text-gray-300 text-sm overflow-x-auto">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.tradescout.com/v1/users/me`}
                      </pre>
                    </div>

                    <div className="bg-navy-900/50 rounded-lg p-4">
                      <h4 className="text-orange-400 font-medium mb-2">Create Listing</h4>
                      <pre className="text-gray-300 text-sm overflow-x-auto">
{`curl -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Kitchen Remodel","price":15000}' \\
  https://api.tradescout.com/v1/listings`}
                      </pre>
                    </div>

                    <div className="bg-navy-900/50 rounded-lg p-4">
                      <h4 className="text-orange-400 font-medium mb-2">Webhook Verification</h4>
                      <pre className="text-gray-300 text-sm overflow-x-auto">
{`const signature = req.headers['x-tradescout-signature'];
const payload = JSON.stringify(req.body);
const expectedSignature = 
  crypto.createHmac('sha256', webhookSecret)
    .update(payload).digest('hex');`}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default APIIntegrations;