import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Users, 
  Phone, 
  Mail, 
  MapPin, 
  Calculator,
  Clock,
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface QuoteFormProps {
  serviceType?: string;
  estimateData?: any;
  prefilledData?: {
    projectType?: string;
    description?: string;
    location?: string;
  };
  onSuccess?: () => void;
  compact?: boolean;
}

export default function QuoteForm({ 
  serviceType = "general",
  estimateData,
  prefilledData,
  onSuccess,
  compact = false 
}: QuoteFormProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    projectType: prefilledData?.projectType || '',
    description: prefilledData?.description || '',
    urgency: 'planning',
    contactPreference: 'phone',
    routingType: 'top3',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    zipCode: '',
    agreedToTerms: false,
  });

  const [step, setStep] = useState(1);
  const totalSteps = isAuthenticated ? 2 : 3;

  const leadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/leads', data);
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted!",
        description: "We'll connect you with qualified contractors shortly.",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to submit a quote request.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Submission Error",
        description: "Failed to submit your request. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreedToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms of service.",
        variant: "destructive",
      });
      return;
    }

    const leadData = {
      projectType: formData.projectType,
      description: formData.description,
      urgency: formData.urgency,
      contactPreference: formData.contactPreference,
      routingType: formData.routingType,
      tradeId: 'general', // This would be determined by project type
      countyId: '06037', // This would be determined by zip code lookup
      estimatedValue: estimateData ? (estimateData.low + estimateData.high) / 2 : null,
      calculatorData: estimateData || null,
      // Include contact info if not authenticated
      ...(!isAuthenticated && {
        contactInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          email: formData.email,
          zipCode: formData.zipCode,
        }
      })
    };

    leadMutation.mutate(leadData);
  };

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <Card className="bg-navy-700 border-navy-600">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            {formData.routingType === 'top3' ? (
              <>
                <Users className="h-5 w-5" />
                Get 3 Free Estimates
              </>
            ) : (
              <>
                <Phone className="h-5 w-5" />
                Request Contact
              </>
            )}
          </CardTitle>
          <Badge variant="outline" className="text-orange-400 border-orange-400">
            Step {step} of {totalSteps}
          </Badge>
        </div>
        
        {estimateData && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mt-4">
            <div className="flex items-center gap-2 text-orange-400 text-sm">
              <Calculator className="h-4 w-4" />
              Estimated Range: ${estimateData.low?.toLocaleString()} - ${estimateData.high?.toLocaleString()}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Project Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-2 block">Project Type *</Label>
                <Select 
                  value={formData.projectType} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, projectType: value }))}
                >
                  <SelectTrigger className="form-field">
                    <SelectValue placeholder="Select your project type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roof-replacement">Roof Replacement</SelectItem>
                    <SelectItem value="roof-repair">Roof Repair</SelectItem>
                    <SelectItem value="plumbing-repair">Plumbing Repair</SelectItem>
                    <SelectItem value="electrical-work">Electrical Work</SelectItem>
                    <SelectItem value="hvac-installation">HVAC Installation</SelectItem>
                    <SelectItem value="kitchen-remodel">Kitchen Remodel</SelectItem>
                    <SelectItem value="bathroom-remodel">Bathroom Remodel</SelectItem>
                    <SelectItem value="flooring">Flooring Installation</SelectItem>
                    <SelectItem value="painting">Interior/Exterior Painting</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Project Description *</Label>
                <Textarea
                  placeholder="Describe your project in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="form-field min-h-24"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 mb-2 block">Timeline</Label>
                  <Select 
                    value={formData.urgency} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value }))}
                  >
                    <SelectTrigger className="form-field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          Emergency (ASAP)
                        </div>
                      </SelectItem>
                      <SelectItem value="week">Within a week</SelectItem>
                      <SelectItem value="month">Within a month</SelectItem>
                      <SelectItem value="planning">Still planning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-300 mb-2 block">Preferred Contact</Label>
                  <Select 
                    value={formData.contactPreference} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, contactPreference: value }))}
                  >
                    <SelectTrigger className="form-field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Call
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-gray-300 mb-3 block">How would you like to connect?</Label>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="top3"
                      checked={formData.routingType === 'top3'}
                      onCheckedChange={(checked) => {
                        if (checked) setFormData(prev => ({ ...prev, routingType: 'top3' }));
                      }}
                      className="mt-1"
                    />
                    <div>
                      <label htmlFor="top3" className="text-white font-medium cursor-pointer">
                        Match me with 3 top contractors (Recommended)
                      </label>
                      <p className="text-gray-400 text-sm">
                        We'll select the best 3 contractors based on your project and location
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="browse"
                      checked={formData.routingType === 'browse'}
                      onCheckedChange={(checked) => {
                        if (checked) setFormData(prev => ({ ...prev, routingType: 'browse' }));
                      }}
                      className="mt-1"
                    />
                    <div>
                      <label htmlFor="browse" className="text-white font-medium cursor-pointer">
                        I want to browse contractors myself
                      </label>
                      <p className="text-gray-400 text-sm">
                        View all contractors in your area and contact them directly
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                type="button" 
                onClick={nextStep}
                disabled={!formData.projectType || !formData.description}
                className="w-full bg-orange-500 hover:bg-orange-600 glow-effect"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Contact Info (if not authenticated) */}
          {step === 2 && !isAuthenticated && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Contact Information</h3>
                <p className="text-gray-400 text-sm">
                  We need your contact info to connect you with contractors
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 mb-2 block">First Name *</Label>
                  <Input
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="form-field"
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-300 mb-2 block">Last Name *</Label>
                  <Input
                    type="text"
                    placeholder="Smith"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="form-field"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Phone Number *</Label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="form-field"
                  required
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Email Address *</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="form-field"
                  required
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">ZIP Code *</Label>
                <Input
                  type="text"
                  placeholder="90210"
                  value={formData.zipCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                  className="form-field"
                  maxLength={5}
                  required
                />
              </div>

              <div className="flex space-x-3">
                <Button 
                  type="button" 
                  onClick={prevStep}
                  variant="outline"
                  className="flex-1 border-navy-500 text-white hover:bg-navy-600"
                >
                  Back
                </Button>
                <Button 
                  type="button" 
                  onClick={nextStep}
                  disabled={!formData.firstName || !formData.lastName || !formData.phone || !formData.email || !formData.zipCode}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 glow-effect"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Final Step: Confirmation */}
          {step === totalSteps && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Review & Submit</h3>
                <p className="text-gray-400 text-sm">
                  Please review your request before submitting
                </p>
              </div>

              {/* Summary */}
              <div className="bg-navy-600 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-gray-400 text-sm">Project:</span>
                  <p className="text-white">{formData.projectType}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Description:</span>
                  <p className="text-white text-sm">{formData.description}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Timeline:</span>
                  <p className="text-white">{formData.urgency}</p>
                </div>
                {formData.routingType === 'top3' && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    We'll match you with 3 top contractors
                  </div>
                )}
              </div>

              {/* Terms Agreement */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={formData.agreedToTerms}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, agreedToTerms: !!checked }))}
                  className="mt-1"
                />
                <label htmlFor="terms" className="text-gray-400 text-sm cursor-pointer">
                  I agree to be contacted by contractors regarding my project and accept the{' '}
                  <a href="/terms" className="text-orange-500 hover:text-orange-400">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-orange-500 hover:text-orange-400">
                    Privacy Policy
                  </a>
                </label>
              </div>

              <div className="flex space-x-3">
                <Button 
                  type="button" 
                  onClick={prevStep}
                  variant="outline"
                  className="flex-1 border-navy-500 text-white hover:bg-navy-600"
                >
                  Back
                </Button>
                <Button 
                  type="submit"
                  disabled={leadMutation.isPending || !formData.agreedToTerms}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 glow-effect"
                >
                  {leadMutation.isPending ? (
                    'Submitting...'
                  ) : formData.routingType === 'top3' ? (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Get My 3 Quotes
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
