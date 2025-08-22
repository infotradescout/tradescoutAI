import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Building, Shield, Star, CheckCircle, Upload, Phone, Mail, MapPin } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { County } from "@shared/schema";

const contractorSignupSchema = z.object({
  // Company Information
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  
  // Location & Service Areas
  primaryState: z.string().min(1, "Please select your primary state"),
  primaryCounty: z.string().min(1, "Please select your primary county"),
  serviceRadius: z.string().min(1, "Please select your service radius"),
  
  // Business Details
  yearsInBusiness: z.coerce.number().min(0, "Years in business must be 0 or greater"),
  licenseNumber: z.string().min(1, "License number is required"),
  insuranceProvider: z.string().min(1, "Insurance provider is required"),
  
  // Services
  primaryTrade: z.string().min(1, "Please select your primary trade"),
  specialties: z.array(z.string()).min(1, "Please select at least one specialty"),
  
  // Business Description
  about: z.string().min(50, "Please provide at least 50 characters describing your business"),
  
  // Contact Preferences
  preferredContact: z.enum(["phone", "email", "both"]),
  
  // Agreement
  agreeToTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
  agreeToVerification: z.boolean().refine(val => val === true, "You must agree to verification process")
});

type ContractorSignupForm = z.infer<typeof contractorSignupSchema>;

const states = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

const trades = [
  'General Contractor',
  'Roofing',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Flooring',
  'Painting',
  'Kitchen Remodeling',
  'Bathroom Remodeling',
  'Landscaping',
  'Concrete',
  'Fencing'
];

const specialties = [
  'Emergency Services',
  'Residential',
  'Commercial',
  'New Construction',
  'Remodeling',
  'Repair Services',
  'Maintenance',
  'Green/Eco-Friendly',
  'Luxury Projects',
  'Insurance Claims'
];

export default function ContractorSignup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState("");
  const { toast } = useToast();

  // Fetch counties for selected state
  const { data: counties } = useQuery<County[]>({
    queryKey: ['/api/counties', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const response = await fetch(`/api/counties?state=${selectedState}`);
      if (!response.ok) throw new Error('Failed to fetch counties');
      return response.json();
    },
    enabled: !!selectedState,
  });

  const form = useForm<ContractorSignupForm>({
    resolver: zodResolver(contractorSignupSchema),
    defaultValues: {
      companyName: "",
      email: "",
      phone: "",
      website: "",
      primaryState: "",
      primaryCounty: "",
      serviceRadius: "",
      yearsInBusiness: 0,
      licenseNumber: "",
      insuranceProvider: "",
      primaryTrade: "",
      specialties: [],
      about: "",
      preferredContact: "both",
      agreeToTerms: false,
      agreeToVerification: false
    }
  });

  const signupMutation = useMutation({
    mutationFn: async (data: ContractorSignupForm) => {
      const response = await fetch('/api/contractor-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Signup failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted!",
        description: "We'll review your application and contact you within 24-48 hours.",
      });
      setCurrentStep(5); // Success step
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: ContractorSignupForm) => {
    signupMutation.mutate({ ...data, specialties: selectedSpecialties });
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(specialty) 
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
    form.setValue('specialties', 
      selectedSpecialties.includes(specialty)
        ? selectedSpecialties.filter(s => s !== specialty)
        : [...selectedSpecialties, specialty]
    );
  };

  // Reset county when state changes
  useEffect(() => {
    if (selectedState) {
      form.setValue('primaryCounty', '');
    }
  }, [selectedState, form]);

  if (currentStep === 5) {
    return (
      <div className="min-h-screen bg-navy-900 py-12">
        <SEOHelmet
          title="Application Submitted - TradeScout Contractor Signup"
          description="Your contractor application has been submitted successfully."
        />
        <div className="max-w-2xl mx-auto px-4">
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-white mb-4">Application Submitted!</h1>
              <p className="text-gray-300 mb-6">
                Thank you for applying to join TradeScout. We'll review your application and contact you within 24-48 hours.
              </p>
              <div className="bg-navy-600 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Next Steps:</h3>
                <ul className="text-gray-300 text-left space-y-2">
                  <li>• We'll verify your license and insurance</li>
                  <li>• Our team will review your business information</li>
                  <li>• You'll receive an email with your approval status</li>
                  <li>• Once approved, you'll be live on the contractor board</li>
                </ul>
              </div>
              <Button 
                onClick={() => window.location.href = '/contractors/board'}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                View Contractor Board
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 py-12">
      <SEOHelmet
        title="Join TradeScout - Contractor Registration"
        description="Join TradeScout's verified contractor network. Get more leads, showcase your work, and grow your business with our contractor platform."
        keywords="contractor registration, join contractor network, get more leads, contractor marketing"
      />
      
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Join TradeScout</h1>
          <p className="text-xl text-gray-300 mb-6">
            Get verified and start receiving quality leads from homeowners in your area
          </p>
          
          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-navy-700 rounded-lg p-4">
              <Star className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-white">Quality Leads</h3>
              <p className="text-gray-300 text-sm">Connect with homeowners actively seeking your services</p>
            </div>
            <div className="bg-navy-700 rounded-lg p-4">
              <Shield className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-white">Verified Badge</h3>
              <p className="text-gray-300 text-sm">Stand out with our verification badge</p>
            </div>
            <div className="bg-navy-700 rounded-lg p-4">
              <Building className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-white">Free Listing</h3>
              <p className="text-gray-300 text-sm">No upfront costs, only pay for quality leads</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step <= currentStep ? 'bg-orange-500 text-white' : 'bg-navy-600 text-gray-400'
                }`}
              >
                {step}
              </div>
            ))}
          </div>
          <div className="w-full bg-navy-600 rounded-full h-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card className="bg-navy-700 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">
                  {currentStep === 1 && "Company Information"}
                  {currentStep === 2 && "Location & Service Areas"}
                  {currentStep === 3 && "Business Details & Licensing"}
                  {currentStep === 4 && "Final Details & Agreement"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Step 1: Company Information */}
                {currentStep === 1 && (
                  <>
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Company Name *</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-navy-800 border-navy-600 text-white" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Business Email *</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" className="bg-navy-800 border-navy-600 text-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Business Phone *</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" className="bg-navy-800 border-navy-600 text-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Website (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} type="url" className="bg-navy-800 border-navy-600 text-white" placeholder="https://yourcompany.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Step 2: Location & Service Areas */}
                {currentStep === 2 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="primaryState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Primary State *</FormLabel>
                            <Select onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedState(value);
                            }} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-navy-800 border-navy-600 text-white">
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-navy-700 border-navy-600">
                                {states.map((state) => (
                                  <SelectItem key={state.code} value={state.code} className="text-white hover:bg-navy-600">
                                    {state.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="primaryCounty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Primary County *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedState}>
                              <FormControl>
                                <SelectTrigger className="bg-navy-800 border-navy-600 text-white">
                                  <SelectValue placeholder={selectedState ? "Select county" : "Select state first"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-navy-700 border-navy-600">
                                {counties?.map((county) => (
                                  <SelectItem key={county.fips} value={county.fips} className="text-white hover:bg-navy-600">
                                    {county.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="serviceRadius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Service Radius *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-navy-800 border-navy-600 text-white">
                                <SelectValue placeholder="Select service radius" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-navy-700 border-navy-600">
                              <SelectItem value="10" className="text-white hover:bg-navy-600">Within 10 miles</SelectItem>
                              <SelectItem value="25" className="text-white hover:bg-navy-600">Within 25 miles</SelectItem>
                              <SelectItem value="50" className="text-white hover:bg-navy-600">Within 50 miles</SelectItem>
                              <SelectItem value="100" className="text-white hover:bg-navy-600">Within 100 miles</SelectItem>
                              <SelectItem value="statewide" className="text-white hover:bg-navy-600">Statewide</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Step 3: Business Details & Licensing */}
                {currentStep === 3 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="yearsInBusiness"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Years in Business *</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="0" className="bg-navy-800 border-navy-600 text-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="primaryTrade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Primary Trade *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-navy-800 border-navy-600 text-white">
                                  <SelectValue placeholder="Select your primary trade" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-navy-700 border-navy-600">
                                {trades.map((trade) => (
                                  <SelectItem key={trade} value={trade.toLowerCase().replace(/\s+/g, '-')} className="text-white hover:bg-navy-600">
                                    {trade}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="licenseNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">License Number *</FormLabel>
                            <FormControl>
                              <Input {...field} className="bg-navy-800 border-navy-600 text-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="insuranceProvider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Insurance Provider *</FormLabel>
                            <FormControl>
                              <Input {...field} className="bg-navy-800 border-navy-600 text-white" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div>
                      <FormLabel className="text-gray-300 mb-3 block">Specialties *</FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {specialties.map((specialty) => (
                          <div
                            key={specialty}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedSpecialties.includes(specialty)
                                ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                : 'bg-navy-800 border-navy-600 text-gray-300 hover:border-orange-500/50'
                            }`}
                            onClick={() => toggleSpecialty(specialty)}
                          >
                            <span className="text-sm">{specialty}</span>
                          </div>
                        ))}
                      </div>
                      {selectedSpecialties.length === 0 && form.formState.errors.specialties && (
                        <p className="text-red-500 text-sm mt-2">Please select at least one specialty</p>
                      )}
                    </div>
                  </>
                )}

                {/* Step 4: Final Details & Agreement */}
                {currentStep === 4 && (
                  <>
                    <FormField
                      control={form.control}
                      name="about"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">About Your Business *</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field}
                              className="bg-navy-800 border-navy-600 text-white min-h-[100px]"
                              placeholder="Tell homeowners about your company, experience, and what makes you stand out..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="preferredContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Preferred Contact Method *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-navy-800 border-navy-600 text-white">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-navy-700 border-navy-600">
                              <SelectItem value="phone" className="text-white hover:bg-navy-600">Phone</SelectItem>
                              <SelectItem value="email" className="text-white hover:bg-navy-600">Email</SelectItem>
                              <SelectItem value="both" className="text-white hover:bg-navy-600">Both</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="agreeToTerms"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="border-navy-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-gray-300">
                                I agree to the Terms of Service and Privacy Policy *
                              </FormLabel>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="agreeToVerification"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="border-navy-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-gray-300">
                                I agree to license and insurance verification *
                              </FormLabel>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="border-navy-600 text-gray-300 hover:bg-navy-600"
                  >
                    Previous
                  </Button>
                  
                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={signupMutation.isPending}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {signupMutation.isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}