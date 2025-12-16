import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, Clock, AlertTriangle, DollarSign, Users, Award } from 'lucide-react';

const BackgroundCheck = memo(function BackgroundCheck() {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('standard');

  const packages = [
    {
      id: 'basic',
      name: 'Basic Check',
      price: '$19.99',
      duration: '1-2 business days',
      features: [
        'Criminal history search',
        'Identity verification',
        'Sex offender registry',
        'Basic credit check'
      ],
      recommended: false
    },
    {
      id: 'standard',
      name: 'Standard Check',
      price: '$29.99',
      duration: '2-3 business days',
      features: [
        'Everything in Basic',
        'Employment verification',
        'Education verification',
        'Professional references',
        'Extended criminal search'
      ],
      recommended: true
    },
    {
      id: 'comprehensive',
      name: 'Comprehensive Check',
      price: '$49.99',
      duration: '3-5 business days',
      features: [
        'Everything in Standard',
        'Federal criminal records',
        'Motor vehicle records',
        'Social media screening',
        'Professional license verification',
        'Civil court records'
      ],
      recommended: false
    }
  ];

  const benefits = [
    {
      icon: Shield,
      title: "Enhanced Trust",
      description: "Display a verified background check badge on your profile"
    },
    {
      icon: Users,
      title: "Customer Confidence",
      description: "Homeowners prefer contractors with verified backgrounds"
    },
    {
      icon: Award,
      title: "Elite Status",
      description: "Join the top tier of verified contractors on the platform"
    },
    {
      icon: DollarSign,
      title: "Better Opportunities",
      description: "Access to higher-value projects and premium leads"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Background Check Verification</h1>
          <p className="text-xl text-gray-300">
            Complete a professional background check to achieve elite verification status
          </p>
        </div>

        {/* Benefits Overview */}
        <Card className="bg-[#1a2332]/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Elite Verification Benefits
            </CardTitle>
            <CardDescription className="text-gray-400">
              Why contractors choose background verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div key={index} className="text-center p-4">
                    <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-orange-400" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">{benefit.title}</h3>
                    <p className="text-sm text-gray-400">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Package Selection */}
        <Card className="bg-[#1a2332]/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Choose Your Background Check Package</CardTitle>
            <CardDescription className="text-gray-400">
              Select the level of verification that's right for your business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div 
                  key={pkg.id}
                  className={`relative p-6 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPackage === pkg.id 
                      ? 'border-orange-500 bg-orange-500/10' 
                      : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                  }`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  {pkg.recommended && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-orange-600 hover:bg-orange-700">
                      Recommended
                    </Badge>
                  )}
                  
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
                    <div className="text-3xl font-bold text-orange-400 mb-1">{pkg.price}</div>
                    <p className="text-sm text-gray-400">{pkg.duration}</p>
                  </div>
                  
                  <ul className="space-y-2 mb-6">
                    {pkg.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-gray-300">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="flex items-center justify-center">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      selectedPackage === pkg.id 
                        ? 'border-orange-500 bg-orange-500' 
                        : 'border-gray-400'
                    }`}>
                      {selectedPackage === pkg.id && (
                        <div className="w-full h-full rounded-full bg-[#0f1419]"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Personal Information Form */}
        <Card className="bg-[#1a2332]/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Personal Information</CardTitle>
            <CardDescription className="text-gray-400">
              Provide accurate information for background verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first-name" className="text-gray-300">First Name</Label>
                <Input 
                  id="first-name"
                  placeholder="Enter first name"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="last-name" className="text-gray-300">Last Name</Label>
                <Input 
                  id="last-name"
                  placeholder="Enter last name"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="date-of-birth" className="text-gray-300">Date of Birth</Label>
                <Input 
                  id="date-of-birth"
                  type="date"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="ssn" className="text-gray-300">Social Security Number</Label>
                <Input 
                  id="ssn"
                  placeholder="123-45-6789"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="address" className="text-gray-300">Current Address</Label>
                <Input 
                  id="address"
                  placeholder="Enter full address"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-gray-300">Phone Number</Label>
                <Input 
                  id="phone"
                  placeholder="(555) 123-4567"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Process Timeline */}
        <Card className="bg-[#1a2332]/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Verification Process</CardTitle>
            <CardDescription className="text-gray-400">
              What to expect during your background check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Submit Application</h3>
                  <p className="text-gray-400 text-sm">
                    Complete the form and payment to initiate your background check
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Processing</h3>
                  <p className="text-gray-400 text-sm">
                    Our verified partner conducts comprehensive background screening
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Verification Complete</h3>
                  <p className="text-gray-400 text-sm">
                    Receive your elite verification badge and enhanced profile features
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms and Submit */}
        <Card className="bg-[#1a2332]/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-400 mb-2">Important Information</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      <li>• All information is encrypted and securely processed</li>
                      <li>• Background checks are conducted by certified third-party vendors</li>
                      <li>• Results are confidential and only used for verification purposes</li>
                      <li>• Fees are non-refundable once processing begins</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox 
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-gray-300 text-sm leading-relaxed">
                  I agree to the background check terms and conditions, privacy policy, and authorize 
                  the release of information for verification purposes. I understand that providing 
                  false information may result in account termination.
                </Label>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                  disabled={!agreedToTerms}
                >
                  Proceed to Payment - {packages.find(p => p.id === selectedPackage)?.price}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default BackgroundCheck;