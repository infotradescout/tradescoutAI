import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, HardHat, Phone, MapPin, Building, Car, Wrench } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocation } from "wouter";

const profileSetupSchema = z.object({
  role: z.enum(['homeowner', 'contractor_user', 'realtor', 'vehicle_dealer', 'helper']),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  // Contractor-specific fields
  companyName: z.string().optional(),
  businessDescription: z.string().optional(),
  licenseNumber: z.string().optional(),
  yearsInBusiness: z.number().optional(),
  serviceAreas: z.array(z.string()).optional(),
  isGeneralContractor: z.boolean().optional(),
  isResidentialContractor: z.boolean().optional(),
  acceptsSubcontractWork: z.boolean().optional(),
});

type ProfileSetupData = z.infer<typeof profileSetupSchema>;

export default function ProfileSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedRole, setSelectedRole] = useState<'homeowner' | 'contractor_user' | 'realtor' | 'vehicle_dealer' | 'helper' | null>(null);

  const form = useForm<ProfileSetupData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      role: selectedRole || 'homeowner',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      companyName: '',
      businessDescription: '',
      licenseNumber: '',
      yearsInBusiness: 0,
      serviceAreas: [],
      isGeneralContractor: false,
      isResidentialContractor: false,
      acceptsSubcontractWork: false,
    },
  });

  const setupProfileMutation = useMutation({
    mutationFn: async (data: ProfileSetupData) => {
      // apiRequest already returns parsed JSON/text; do not treat it as a Response.
      return apiRequest("POST", "/api/auth/setup-profile", data);
    },
    onSuccess: (result: any) => {
      toast({
        title: "Profile Setup Complete!",
        description: selectedRole === 'contractor_user' 
          ? "Welcome to TradeScout! Your contractor profile has been created."
          : selectedRole === 'realtor'
          ? "Welcome to TradeScout! Your realtor profile has been created."
          : selectedRole === 'vehicle_dealer'
          ? "Welcome to TradeScout! Your dealer profile has been created."
          : selectedRole === 'helper'
          ? "Welcome to TradeScout! Your helper profile has been created."
          : "Welcome to TradeScout! You can now find and connect with contractors.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Redirect to Profile Editor (website surface)
      const profileSlug = result?.createdProfileSlug;
      if (profileSlug) {
        setLocation(`/p/${profileSlug}/edit`);
        return;
      }

      // Fallbacks if API didn't return a slug
      if (selectedRole === 'contractor_user') setLocation('/contractor-dashboard');
      else if (selectedRole === 'realtor') setLocation('/realtor-dashboard');
      else if (selectedRole === 'vehicle_dealer') setLocation('/dealer-dashboard');
      else if (selectedRole === 'helper') setLocation('/helper-dashboard');
      else setLocation('/homeowner-dashboard');
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to complete profile setup. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRoleSelection = (role: 'homeowner' | 'contractor_user' | 'realtor' | 'vehicle_dealer' | 'helper') => {
    setSelectedRole(role);
    form.setValue('role', role);
  };

  const onSubmit = (data: ProfileSetupData) => {
    setupProfileMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="ts-surface px-4 py-6 md:px-10 md:py-8 text-white">Please log in to complete your profile setup.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl ts-surface px-4 py-6 md:px-10 md:py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-gray-300">Tell us about yourself to get the best TradeScout experience</p>
        </div>

        {!selectedRole ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card 
              className="cursor-pointer transition-all hover:ring-2 hover:ring-orange-500 bg-navy-800 border-navy-700"
              onClick={() => handleRoleSelection('homeowner')}
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-white">I'm a Homeowner</CardTitle>
                <CardDescription className="text-gray-300">
                  I need contractors for home improvement projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Find verified local contractors</li>
                  <li>• Get free project estimates</li>
                  <li>• Read RECOMMENDATIONS and ratings</li>
                  <li>• Compare multiple quotes</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:ring-2 hover:ring-orange-500 bg-navy-800 border-navy-700"
              onClick={() => handleRoleSelection('contractor_user')}
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <HardHat className="w-8 h-8 text-orange-600" />
                </div>
                <CardTitle className="text-white">I'm a Contractor</CardTitle>
                <CardDescription className="text-gray-300">
                  I provide home improvement services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Get qualified project connections</li>
                  <li>• Build your online presence</li>
                  <li>• Connect with homeowners</li>
                  <li>• Grow your business</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:ring-2 hover:ring-orange-500 bg-navy-800 border-navy-700"
              onClick={() => handleRoleSelection('realtor')}
              data-testid="card-select-realtor"
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Building className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-white">I'm a Realtor</CardTitle>
                <CardDescription className="text-gray-300">
                  I help clients buy and sell properties
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Connect with trusted contractors</li>
                  <li>• Refer clients to quality professionals</li>
                  <li>• Build referral partnerships</li>
                  <li>• Enhance property value insights</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:ring-2 hover:ring-orange-500 bg-navy-800 border-navy-700"
              onClick={() => handleRoleSelection('vehicle_dealer')}
              data-testid="card-select-vehicle-dealer"
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Car className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-white">I'm a Vehicle Dealer</CardTitle>
                <CardDescription className="text-gray-300">
                  I sell cars, trucks, and other vehicles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Connect with homeowner customers</li>
                  <li>• Partner with contractors for financing</li>
                  <li>• Build referral networks</li>
                  <li>• Grow vehicle sales business</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:ring-2 hover:ring-orange-500 bg-navy-800 border-navy-700"
              onClick={() => handleRoleSelection('helper')}
              data-testid="card-select-helper"
            >
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Wrench className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle className="text-white">I'm a Helper</CardTitle>
                <CardDescription className="text-gray-300">
                  I help with tasks and projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Find flexible work opportunities</li>
                  <li>• Help homeowners and contractors</li>
                  <li>• Build experience and reputation</li>
                  <li>• Earn on your schedule</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="bg-navy-800 border-navy-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {selectedRole === 'contractor_user' ? (
                  <>
                    <HardHat className="w-5 h-5" />
                    Contractor Profile Setup
                  </>
                ) : selectedRole === 'realtor' ? (
                  <>
                    <Building className="w-5 h-5" />
                    Realtor Profile Setup
                  </>
                ) : selectedRole === 'vehicle_dealer' ? (
                  <>
                    <Car className="w-5 h-5" />
                    Vehicle Dealer Profile Setup
                  </>
                ) : selectedRole === 'helper' ? (
                  <>
                    <Wrench className="w-5 h-5" />
                    Helper Profile Setup
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5" />
                    Homeowner Profile Setup
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-gray-300">
                {selectedRole === 'contractor_user' 
                  ? "Tell us about your contracting business"
                  : selectedRole === 'realtor'
                  ? "Tell us about your real estate business"
                  : selectedRole === 'vehicle_dealer'
                  ? "Tell us about your dealership"
                  : selectedRole === 'helper'
                  ? "Tell us about your skills and availability"
                  : "Tell us about your home improvement needs"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Contact Information */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="(555) 123-4567"
                              {...field}
                              className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">ZIP Code</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="12345"
                              {...field}
                              className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Address Information */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Address
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123 Main Street"
                            {...field}
                            className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">City</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Los Angeles"
                              {...field}
                              className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">State</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="CA"
                              {...field}
                              className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Contractor-specific fields */}
                  {selectedRole === 'contractor_user' && (
                    <>
                      <div className="border-t border-navy-600 pt-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <Building className="w-5 h-5" />
                          Business Information
                        </h3>
                        
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <FormField
                            control={form.control}
                            name="companyName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300">Company Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="ABC Construction LLC"
                                    {...field}
                                    className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="licenseNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-300">License Number</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="License #123456"
                                    {...field}
                                    className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="businessDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Business Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Tell us about your services, specialties, and what makes your business unique..."
                                  {...field}
                                  className="bg-navy-700 border-navy-600 text-white placeholder-gray-400 min-h-[100px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Contractor Type */}
                        <div className="border-t border-navy-600 pt-4">
                          <h4 className="text-md font-semibold text-white mb-3">Contractor Type</h4>
                          <p className="text-gray-400 text-sm mb-4">Select all that apply to describe your business</p>
                          
                          <div className="space-y-3">
                            <FormField
                              control={form.control}
                              name="isGeneralContractor"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-gray-300">
                                      General Contractor
                                    </FormLabel>
                                    <p className="text-sm text-gray-400">
                                      I manage complete construction projects and coordinate with other trades
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="isResidentialContractor"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-gray-300">
                                      Residential Contractor
                                    </FormLabel>
                                    <p className="text-sm text-gray-400">
                                      I specialize in home improvement and residential projects
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="acceptsSubcontractWork"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-gray-300">
                                      Accept Subcontract Work
                                    </FormLabel>
                                    <p className="text-sm text-gray-400">
                                      I'm available to work as a subcontractor for other contractors
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-4 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedRole(null)}
                      className="border-navy-500 text-gray-300 hover:bg-navy-600"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={setupProfileMutation.isPending}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {setupProfileMutation.isPending ? 'Setting up...' : 'Complete Setup'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}