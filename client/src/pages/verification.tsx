import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, AlertCircle, Upload, FileText, Shield, Camera } from 'lucide-react';

const Verification = memo(function Verification() {
  const [activeTab, setActiveTab] = useState('overview');

  const verificationStatus = {
    identity: { status: 'completed', label: 'Identity Verified', icon: CheckCircle },
    address: { status: 'pending', label: 'Address Verification', icon: Clock },
    license: { status: 'required', label: 'License Required', icon: AlertCircle },
    insurance: { status: 'required', label: 'Insurance Required', icon: AlertCircle },
    background: { status: 'optional', label: 'Background Check', icon: Shield }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'pending': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'required': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'optional': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'pending': return Clock;
      case 'required': return AlertCircle;
      default: return Shield;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Verification Center</h1>
          <p className="text-xl text-gray-300">
            Complete your verification to unlock full platform access and build trust with customers
          </p>
        </div>

        {/* Verification Status Overview */}
        <Card
          className="border-slate-700 mb-8"
          style={{ backgroundColor: 'var(--surface-card)' }}
        >
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Verification Status
            </CardTitle>
            <CardDescription className="text-gray-400">
              Track your verification progress across all requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(verificationStatus).map(([key, item]) => {
                const Icon = item.icon;
                return (
                  <div key={key} className={`p-4 rounded-lg border ${getStatusColor(item.status)}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium text-sm">{item.status.toUpperCase()}</span>
                    </div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Verification Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className="grid w-full grid-cols-5"
            style={{ backgroundColor: 'var(--surface-card)' }}
          >
            <TabsTrigger value="overview" className="data-[state=active]:bg-orange-600">Overview</TabsTrigger>
            <TabsTrigger value="identity" className="data-[state=active]:bg-orange-600">Identity</TabsTrigger>
            <TabsTrigger value="address" className="data-[state=active]:bg-orange-600">Address</TabsTrigger>
            <TabsTrigger value="professional" className="data-[state=active]:bg-orange-600">Professional</TabsTrigger>
            <TabsTrigger value="background" className="data-[state=active]:bg-orange-600">Background</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card
              className="border-slate-700"
              style={{ backgroundColor: 'var(--surface-card)' }}
            >
              <CardHeader>
                <CardTitle className="text-white">Verification Overview</CardTitle>
                <CardDescription className="text-gray-400">
                  Complete verification requirements to access premium features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-emerald-600/10 border border-emerald-600/20 rounded-lg">
                      <h3 className="text-lg font-semibold text-emerald-400 mb-2">Benefits of Verification</h3>
                      <ul className="space-y-2 text-gray-300">
                        <li>• Higher search ranking priority</li>
                        <li>• Customer trust badge display</li>
                        <li>• Access to premium leads</li>
                        <li>• Reduced platform fees</li>
                        <li>• Enhanced profile features</li>
                      </ul>
                    </div>
                    
                    <div className="p-6 bg-orange-600/10 border border-orange-600/20 rounded-lg">
                      <h3 className="text-lg font-semibold text-orange-400 mb-2">Verification Levels</h3>
                      <div className="space-y-2">
                        <Badge className="bg-blue-600 hover:bg-blue-700">Basic (Identity + Address)</Badge>
                        <Badge className="bg-orange-600 hover:bg-orange-700">Professional (+ License + Insurance)</Badge>
                        <Badge className="bg-purple-600 hover:bg-purple-700">Elite (+ Background Check)</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Next Steps</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400" />
                          <span className="text-white">Complete Address Verification</span>
                        </div>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                          Start Now
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-red-400" />
                          <span className="text-white">Upload Professional License</span>
                        </div>
                        <Button size="sm" variant="outline">
                          Required
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="identity">
            <Card
              className="border-slate-700"
              style={{ backgroundColor: 'var(--surface-card)' }}
            >
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Identity Verification - Completed
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Your identity has been successfully verified
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-600/10 border border-emerald-600/20 rounded-lg">
                    <h3 className="font-semibold text-emerald-400 mb-2">Verification Complete</h3>
                    <p className="text-gray-300 text-sm">
                      Your identity was verified on March 15, 2024 using government-issued identification.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <h4 className="font-medium text-white mb-2">Verified Information</h4>
                      <ul className="space-y-1 text-sm text-gray-300">
                        <li>• Full legal name</li>
                        <li>• Date of birth</li>
                        <li>• Government ID number</li>
                        <li>• Photo verification</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <h4 className="font-medium text-white mb-2">Security Features</h4>
                      <ul className="space-y-1 text-sm text-gray-300">
                        <li>• Encrypted data storage</li>
                        <li>• ID document authentication</li>
                        <li>• Liveness detection</li>
                        <li>• Fraud prevention</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="address">
            <Card
              className="border-slate-700"
              style={{ backgroundColor: 'var(--surface-card)' }}
            >
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Address Verification - In Progress
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Verify your business address to complete this requirement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
                    <h3 className="font-semibold text-yellow-400 mb-2">Verification Methods</h3>
                    <p className="text-gray-300 text-sm mb-4">
                      Choose your preferred method to verify your business address:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-700/30 rounded-lg border-2 border-orange-600/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Camera className="w-5 h-5 text-orange-400" />
                          <h4 className="font-medium text-white">Postcard Verification</h4>
                        </div>
                        <p className="text-sm text-gray-300 mb-3">
                          We'll mail a postcard with a verification code to your business address.
                        </p>
                        <Button className="w-full bg-orange-600 hover:bg-orange-700">
                          Request Postcard
                        </Button>
                      </div>
                      
                      <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Upload className="w-5 h-5 text-blue-400" />
                          <h4 className="font-medium text-white">Document Upload</h4>
                        </div>
                        <p className="text-sm text-gray-300 mb-3">
                          Upload a utility bill or official document showing your business address.
                        </p>
                        <Button variant="outline" className="w-full">
                          Upload Document
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="professional">
            <Card
              className="border-slate-700"
              style={{ backgroundColor: 'var(--surface-card)' }}
            >
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  Professional Verification - Required
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Upload your professional license and insurance documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-red-600/10 border border-red-600/20 rounded-lg">
                      <h3 className="font-semibold text-red-400 mb-4">License Verification</h3>
                      <div className="space-y-3">
                        <p className="text-sm text-gray-300">Required documents:</p>
                        <ul className="space-y-1 text-sm text-gray-400">
                          <li>• Current contractor license</li>
                          <li>• State registration certificate</li>
                          <li>• Trade-specific certifications</li>
                        </ul>
                        <Button className="w-full bg-red-600 hover:bg-red-700">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload License
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-red-600/10 border border-red-600/20 rounded-lg">
                      <h3 className="font-semibold text-red-400 mb-4">Insurance Verification</h3>
                      <div className="space-y-3">
                        <p className="text-sm text-gray-300">Required coverage:</p>
                        <ul className="space-y-1 text-sm text-gray-400">
                          <li>• General liability ($1M minimum)</li>
                          <li>• Workers' compensation</li>
                          <li>• Bonding (if applicable)</li>
                        </ul>
                        <Button className="w-full bg-red-600 hover:bg-red-700">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Insurance
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="background">
            <Card
              className="border-slate-700"
              style={{ backgroundColor: "var(--surface-card)" }}
            >
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  Background Check - Optional
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Complete a background check for elite verification status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-6 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                    <h3 className="font-semibold text-blue-400 mb-4">Elite Verification Benefits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ul className="space-y-2 text-gray-300">
                        <li>• Premium badge display</li>
                        <li>• Priority in search results</li>
                        <li>• Access to high-value projects</li>
                        <li>• Enhanced customer trust</li>
                      </ul>
                      <ul className="space-y-2 text-gray-300">
                        <li>• Reduced insurance requirements</li>
                        <li>• Fast-track payment processing</li>
                        <li>• Exclusive contractor events</li>
                        <li>• Advanced analytics access</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-700/30 rounded-lg">
                    <h4 className="font-medium text-white mb-2">Background Check Process</h4>
                    <p className="text-sm text-gray-300 mb-4">
                      Our partner will conduct a comprehensive background check including criminal history, 
                      credit verification, and professional references. The process typically takes 3-5 business days.
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-white">Cost: $29.99</span>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        Start Background Check
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default Verification;