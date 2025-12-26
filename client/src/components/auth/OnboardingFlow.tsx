import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  MapPin, 
  Shield, 
  Upload, 
  Building, 
  Phone, 
  Mail, 
  FileText,
  AlertCircle,
  Clock
} from "lucide-react";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";

interface OnboardingFlowProps {
  role: 'homeowner' | 'contractor';
  userInfo: {
    name?: string;
    email?: string;
    profileImage?: string;
  };
  onComplete: (data: any) => void;
  onSkip: () => void;
}

export function OnboardingFlow({ role, userInfo, onComplete, onSkip }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  
  const totalSteps = role === 'homeowner' ? 3 : 4;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const updateFormData = (data: any) => {
    setFormData((prev: any) => ({ ...prev, ...data }));
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TradeScoutLogo size="lg" variant="gradient" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {role === 'homeowner' ? 'Personal account' : 'Work & services'} setup
          </h1>
          <p className="text-slate-400">Tell us a bit about yourself and where you’re active</p>
          
          {/* Progress Bar */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Step Content */}
        <Card className="bg-slate-800/50 border-slate-700">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-400" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-slate-200">First Name</Label>
                    <Input
                      id="firstName"
                      defaultValue={userInfo.name?.split(' ')[0] || ''}
                      onChange={(e) => updateFormData({ firstName: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-slate-200">Last Name</Label>
                    <Input
                      id="lastName"
                      defaultValue={userInfo.name?.split(' ').slice(1).join(' ') || ''}
                      onChange={(e) => updateFormData({ lastName: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email" className="text-slate-200">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={userInfo.email || ''}
                    onChange={(e) => updateFormData({ email: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-slate-200">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    onChange={(e) => updateFormData({ phone: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-phone"
                  />
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Address (Both Roles) */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  Address Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address" className="text-slate-200">Street Address</Label>
                  <Input
                    id="address"
                    onChange={(e) => updateFormData({ address: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city" className="text-slate-200">City</Label>
                    <Input
                      id="city"
                      onChange={(e) => updateFormData({ city: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state" className="text-slate-200">State</Label>
                    <Input
                      id="state"
                      onChange={(e) => updateFormData({ state: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      data-testid="input-state"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zipCode" className="text-slate-200">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      onChange={(e) => updateFormData({ zipCode: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      data-testid="input-zip"
                    />
                  </div>
                  <div>
                    <Label htmlFor="county" className="text-slate-200">Neighborhood / area</Label>
                    <Input
                      id="county"
                      onChange={(e) => updateFormData({ county: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white"
                      data-testid="input-county"
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Verification Notice */}
          {((role === 'homeowner' && currentStep === 3) || (role === 'contractor' && currentStep === 3)) && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-400" />
                  Verification Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {role === 'homeowner' ? (
                  <div className="space-y-4">
                    <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
                      <h3 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Location & identity checks
                      </h3>
                      <p className="text-slate-300 text-sm mb-3">
                        To keep local interactions trustworthy, we may ask for additional checks before certain actions (like publishing recommendations).
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-400" />
                          <span className="text-slate-300">You’ll still be able to browse and explore right away</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span className="text-slate-300">We’ll guide you if and when extra verification is needed</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-4">
                      <h3 className="text-orange-400 font-semibold mb-2 flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        ID Verification
                      </h3>
                      <p className="text-slate-300 text-sm">
                        For higher-impact actions, we may ask for additional proof that you’re a real person in the area.
                      </p>
                    </div>

                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">What you can do right away:</h4>
                      <ul className="text-slate-300 text-sm space-y-1">
                        <li>• Browse and contact local services</li>
                        <li>• Request help, quotes, and estimates</li>
                        <li>• Use project and planning tools</li>
                        <li>• Chat with people and providers in your area</li>
                      </ul>
                      
                      <h4 className="text-white font-medium mb-2 mt-4">After additional checks:</h4>
                      <ul className="text-slate-300 text-sm space-y-1">
                        <li>• Publish recommendations and public signals</li>
                        <li>• Participate more deeply in community discussions</li>
                        <li>• Access higher-trust features</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-4">
                      <h3 className="text-orange-400 font-semibold mb-2 flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        Business Verification
                      </h3>
                      <p className="text-slate-300 text-sm mb-3">
                        Our team will review your business credentials before you appear on the contractor board.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-400" />
                          <span className="text-slate-300">Admin review typically takes 1-3 business days</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-orange-400" />
                          <span className="text-slate-300">Business license, insurance, and references required</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">What you can do without verification:</h4>
                      <ul className="text-slate-300 text-sm space-y-1">
                        <li>• Complete your profile setup</li>
                        <li>• Upload portfolio photos</li>
                        <li>• Set your service areas</li>
                        <li>• Chat with potential customers</li>
                      </ul>
                      
                      <h4 className="text-white font-medium mb-2 mt-4">After verification:</h4>
                      <ul className="text-slate-300 text-sm space-y-1">
                        <li>• Appear on the public contractor board</li>
                        <li>• Connect with potential customers</li>
                        <li>• Build customer recommendations</li>
                        <li>• Access marketing tools</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* Step 4: Business Info (Contractors Only) */}
          {role === 'contractor' && currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-orange-400" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="businessName" className="text-slate-200">Business Name</Label>
                  <Input
                    id="businessName"
                    onChange={(e) => updateFormData({ businessName: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-business-name"
                  />
                </div>
                <div>
                  <Label htmlFor="licenseNumber" className="text-slate-200">License Number (Optional)</Label>
                  <Input
                    id="licenseNumber"
                    onChange={(e) => updateFormData({ licenseNumber: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-license"
                  />
                </div>
                <div>
                  <Label htmlFor="specialties" className="text-slate-200">Specialties</Label>
                  <Textarea
                    id="specialties"
                    placeholder="Describe your main services and specialties..."
                    onChange={(e) => updateFormData({ specialties: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-specialties"
                  />
                </div>
                <div>
                  <Label htmlFor="yearsExperience" className="text-slate-200">Years of Experience</Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    onChange={(e) => updateFormData({ yearsExperience: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-experience"
                  />
                </div>
              </CardContent>
            </>
          )}

          {/* Navigation Buttons */}
          <CardContent className="pt-0">
            <div className="flex justify-between items-center pt-6 border-t border-slate-700">
              <div className="flex gap-3">
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="text-slate-400 hover:text-slate-300"
                  data-testid="button-skip"
                >
                  Skip for Now
                </Button>
              </div>
              
              <Button
                onClick={handleNext}
                className={`${
                  role === 'homeowner' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-orange-600 hover:bg-orange-700'
                } text-white`}
                data-testid="button-next"
              >
                {currentStep === totalSteps ? 'Complete Setup' : 'Next'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            Your information is secure and will only be used for verification purposes
          </p>
        </div>
      </div>
    </div>
  );
}