import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react";

// ============================================================================
// Types & Validation
// ============================================================================

type UserIntent = "person" | "business";
type BusinessType = "service_provider" | "seller";
type SellerType = "physical" | "online" | "hybrid";

interface Profile {
  userIntent: UserIntent;
  businessType?: BusinessType;
  serviceTags?: string[];
  sellerTags?: string[];
  sellerType?: SellerType;
  id?: string; // temp id for display before submission
}

interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  acceptTerms: boolean;
  profiles: Profile[];
}

// Service categories (hierarchical)
const SERVICE_CATEGORIES = {
  trades: [
    { id: "electrician", label: "Electrician" },
    { id: "plumber", label: "Plumber" },
    { id: "hvac", label: "HVAC" },
    { id: "general_contractor", label: "General Contractor" },
    { id: "carpenter", label: "Carpenter" },
    { id: "roofing", label: "Roofing" },
  ],
  home_services: [
    { id: "cleaning", label: "Cleaning" },
    { id: "landscaping", label: "Landscaping" },
    { id: "painting", label: "Painting" },
    { id: "handyman", label: "Handyman" },
  ],
  professional: [
    { id: "consulting", label: "Consulting" },
    { id: "design", label: "Design" },
    { id: "accounting", label: "Accounting" },
    { id: "legal", label: "Legal" },
  ],
  health_wellness: [
    { id: "healthcare", label: "Healthcare" },
    { id: "fitness", label: "Fitness" },
    { id: "wellness", label: "Wellness" },
  ],
  custom: [{ id: "custom", label: "Other (specify in Scout)" }],
};

// Seller categories (business sellers only, not individuals selling items)
const SELLER_CATEGORIES = {
  food_beverage: [
    { id: "restaurant", label: "Restaurant" },
    { id: "food_truck", label: "Food Truck" },
    { id: "bakery", label: "Bakery" },
    { id: "bar", label: "Bar/Pub" },
  ],
  retail: [
    { id: "boutique", label: "Boutique" },
    { id: "grocery", label: "Grocery" },
    { id: "antique_shop", label: "Antique Shop" },
  ],
  personal_services: [
    { id: "salon", label: "Salon/Spa" },
    { id: "barbershop", label: "Barbershop" },
  ],
  ecommerce: [
    { id: "online_store", label: "Online Retail Store" },
    { id: "saas", label: "SaaS/Software" },
  ],
  other: [{ id: "other", label: "Other Business (specify in profile)" }],
};

const basicInfoSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain number"),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z
      .string()
      .min(1, "Phone is required")
      .refine((v) => v.replace(/\D/g, "").length >= 10, "Please enter a valid phone number"),
    acceptTerms: z.boolean().refine((v) => v === true, "You must accept terms"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// ============================================================================
// Component
// ============================================================================

export default function CreateAccountPortal() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1); // 1: basic info, 2: intent, 3: biz type, 4: specialty, 5: add another, 6: review
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Partial<Profile>>({
    userIntent: "person",
  });

  // Form for basic info
  const {
    control: basicControl,
    handleSubmit: handleBasicSubmit,
    formState: { errors: basicErrors },
    watch: basicWatch,
  } = useForm<z.infer<typeof basicInfoSchema>>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phone: "",
      acceptTerms: false,
    },
  });

  const [basicData, setBasicData] = useState<z.infer<typeof basicInfoSchema> | null>(null);
  const passwordValue = basicWatch("password");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/pre-scout-setup");
    }
  }, [isAuthenticated, user, navigate]);

  // API mutation for signup
  const signupMutation = useMutation({
    mutationFn: async (data: SignupData) => {
      return apiRequest("POST", "/api/auth/register-multi", {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        acceptTerms: data.acceptTerms,
        profiles: data.profiles,
      });
    },
    onSuccess: (resp: any) => {
      toast({
        title: "Account created!",
        description: "Welcome to TradeScout. Let's verify your profiles.",
      });

      if (resp?.emailVerificationRequired) {
        const email = basicData?.email || "";
        navigate(
          `/check-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/pre-scout-setup")}`
        );
        return;
      }

      navigate("/pre-scout-setup");
    },
    onError: (error: any) => {
      const msg = error?.message || "Signup failed. Please try again.";

      if (msg.includes("already exists")) {
        toast({
          title: "Account exists",
          description: "Please log in instead.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/pre-scout-setup?mode=signin");
        }, 1500);
        return;
      }

      toast({
        title: "Signup failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ========================================================================
  // Step 1: Basic Info
  // ========================================================================
  const handleBasicInfoNext = handleBasicSubmit((data) => {
    setBasicData(data);
    setStep(2);
  });

  // ========================================================================
  // Step 2: Intent Choice
  // ========================================================================
  const handleIntentSelect = (intent: UserIntent) => {
    setCurrentProfile({ userIntent: intent });
    setStep(intent === "person" ? 5 : 3); // Skip business type for person
  };

  // ========================================================================
  // Step 3: Business Type
  // ========================================================================
  const handleBusinessTypeSelect = (bType: BusinessType) => {
    setCurrentProfile({ ...currentProfile, businessType: bType });
    setStep(4);
  };

  // ========================================================================
  // Step 4: Specialty Selection
  // ========================================================================
  const handleServiceTagSelect = (tags: string[]) => {
    setCurrentProfile({ ...currentProfile, serviceTags: tags });
    setStep(5);
  };

  const handleSellerTagSelect = (tags: string[], type?: SellerType) => {
    setCurrentProfile({
      ...currentProfile,
      sellerTags: tags,
      sellerType: type,
    });
    setStep(5);
  };

  // ========================================================================
  // Step 5: Add Another Profile or Review
  // ========================================================================
  const handleAddAnotherProfile = () => {
    if (!currentProfile.userIntent) return;

    // Add current profile to list
    const newProfiles = [...profiles, { ...currentProfile } as Profile];
    setProfiles(newProfiles);

    // Reset for next profile
    setCurrentProfile({ userIntent: "person" });
    setStep(2); // Back to intent choice
  };

  const handleGoToReview = () => {
    if (!currentProfile.userIntent) return;

    // Add final profile to list
    const newProfiles = [...profiles, { ...currentProfile } as Profile];
    setProfiles(newProfiles);
    setStep(6);
  };

  // ========================================================================
  // Step 6: Review & Submit
  // ========================================================================
  const handleSubmitSignup = async () => {
    if (!basicData) return;

    const allProfiles = profiles.length > 0 ? profiles : [currentProfile as Profile];

    try {
      await signupMutation.mutateAsync({
        email: basicData.email,
        password: basicData.password,
        confirmPassword: basicData.confirmPassword,
        firstName: basicData.firstName,
        lastName: basicData.lastName,
        phone: basicData.phone,
        acceptTerms: basicData.acceptTerms,
        profiles: allProfiles,
      });
    } catch (err) {
      // Error handled by mutation
    }
  };

  const removeProfile = (index: number) => {
    const newProfiles = profiles.filter((_, i) => i !== index);
    setProfiles(newProfiles);
  };

  // ========================================================================
  // Render
  // ========================================================================

  const describeProfile = (p: Profile) => {
    if (p.userIntent === "person") return "Personal Profile (marketplace access)";
    if (p.businessType === "service_provider") {
      const tags = (p.serviceTags || []).join(", ");
      return tags ? `Service: ${tags}` : "Service Provider";
    }
    if (p.businessType === "seller") {
      const tags = (p.sellerTags || []).join(", ");
      return tags ? `Business: ${tags}` : "Business Seller";
    }
    return "Profile";
  };

  return (
    <>
      <SEOHelmet
        title="Create Account | TradeScout"
        description="Join TradeScout and start making claims in your community."
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 justify-center mb-4">
              <TradeScoutLogo size="md" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">TradeScout</h1>
            <p className="text-sm text-slate-600 mt-1">Make claims. Prove them. Build trust.</p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              {/* STEP 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Create Your Account</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Start by protecting your account with a strong password.
                    </p>
                  </div>

                  <form onSubmit={handleBasicInfoNext} className="space-y-4">
                    {/* Email */}
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <Controller
                        name="email"
                        control={basicControl}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            className="mt-1"
                          />
                        )}
                      />
                      {basicErrors.email && (
                        <p className="text-xs text-red-600 mt-1">{basicErrors.email.message}</p>
                      )}
                    </div>

                    {/* First & Last Name */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="firstName" className="text-sm font-medium">
                          First Name
                        </Label>
                        <Controller
                          name="firstName"
                          control={basicControl}
                          render={({ field }) => (
                            <Input {...field} id="firstName" placeholder="John" className="mt-1" />
                          )}
                        />
                        {basicErrors.firstName && (
                          <p className="text-xs text-red-600 mt-1">
                            {basicErrors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-sm font-medium">
                          Last Name
                        </Label>
                        <Controller
                          name="lastName"
                          control={basicControl}
                          render={({ field }) => (
                            <Input {...field} id="lastName" placeholder="Doe" className="mt-1" />
                          )}
                        />
                        {basicErrors.lastName && (
                          <p className="text-xs text-red-600 mt-1">
                            {basicErrors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium">
                        Phone Number
                      </Label>
                      <Controller
                        name="phone"
                        control={basicControl}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            className="mt-1"
                          />
                        )}
                      />
                      {basicErrors.phone && (
                        <p className="text-xs text-red-600 mt-1">{basicErrors.phone.message}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password
                      </Label>
                      <div className="relative mt-1">
                        <Controller
                          name="password"
                          control={basicControl}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      {basicErrors.password && (
                        <p className="text-xs text-red-600 mt-1">{basicErrors.password.message}</p>
                      )}
                      {passwordValue && (
                        <div className="text-xs text-slate-600 mt-2 space-y-1">
                          <div>✓ At least 8 characters</div>
                          <div>{/[A-Z]/.test(passwordValue) ? "✓" : "•"} Uppercase letter</div>
                          <div>{/[a-z]/.test(passwordValue) ? "✓" : "•"} Lowercase letter</div>
                          <div>{/[0-9]/.test(passwordValue) ? "✓" : "•"} Number</div>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">
                        Confirm Password
                      </Label>
                      <div className="relative mt-1">
                        <Controller
                          name="confirmPassword"
                          control={basicControl}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="••••••••"
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
                        >
                          {showConfirmPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      {basicErrors.confirmPassword && (
                        <p className="text-xs text-red-600 mt-1">
                          {basicErrors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    {/* Terms */}
                    <div className="flex items-start gap-2">
                      <Controller
                        name="acceptTerms"
                        control={basicControl}
                        render={({ field }) => (
                          <Checkbox
                            id="terms"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                          />
                        )}
                      />
                      <label htmlFor="terms" className="text-xs text-slate-600 cursor-pointer">
                        I accept the{" "}
                        <a href="/terms" className="text-blue-600 hover:underline">
                          Terms of Service
                        </a>{" "}
                        and{" "}
                        <a href="/privacy" className="text-blue-600 hover:underline">
                          Privacy Policy
                        </a>
                      </label>
                    </div>
                    {basicErrors.acceptTerms && (
                      <p className="text-xs text-red-600">{basicErrors.acceptTerms.message}</p>
                    )}

                    {/* Next Button */}
                    <Button type="submit" className="w-full mt-6">
                      Next: Tell Us Your Role
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                </div>
              )}

              {/* STEP 2: Intent Choice */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">What's Your Role?</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Choose your primary role. You can add more profiles later.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Person Profile */}
                    <button
                      type="button"
                      onClick={() => handleIntentSelect("person")}
                      className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                      <div className="font-semibold text-slate-900">Personal Profile</div>
                      <p className="text-sm text-slate-600 mt-1">
                        Homeowner, renter, or individual. Can hire contractors, post on marketplace,
                        and sell items locally.
                      </p>
                    </button>

                    {/* Business Profile */}
                    <button
                      type="button"
                      onClick={() => handleIntentSelect("business")}
                      className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                      <div className="font-semibold text-slate-900">Business Profile</div>
                      <p className="text-sm text-slate-600 mt-1">
                        Service provider (contractor, cleaner, consultant) or established business
                        (restaurant, salon, retail).
                      </p>
                    </button>
                  </div>

                  {/* Back */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="w-full"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>
              )}

              {/* STEP 3: Business Type */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Business Type</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Which best describes your business?
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Service Provider */}
                    <button
                      type="button"
                      onClick={() => handleBusinessTypeSelect("service_provider")}
                      className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                      <div className="font-semibold text-slate-900">Service Provider</div>
                      <p className="text-sm text-slate-600 mt-1">
                        Contractor, electrician, plumber, cleaner, consultant, handyman. Will need
                        license/insurance verification.
                      </p>
                    </button>

                    {/* Business Seller */}
                    <button
                      type="button"
                      onClick={() => handleBusinessTypeSelect("seller")}
                      className="w-full p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                      <div className="font-semibold text-slate-900">
                        Business Owner (Retail/Food Service)
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        Restaurant, salon, online store, product company. Will need business
                        registration and tax ID verification.
                      </p>
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(2)}
                    className="w-full"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>
              )}

              {/* STEP 4: Service or Seller Specialty */}
              {step === 4 && currentProfile.businessType === "service_provider" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">What Services?</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Select at least one. More detail can be added in your profile.
                    </p>
                  </div>

                  <ServiceSelectionStep
                    selected={currentProfile.serviceTags || []}
                    onSubmit={handleServiceTagSelect}
                    onBack={() => setStep(3)}
                  />
                </div>
              )}

              {step === 4 && currentProfile.businessType === "seller" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">What Type of Business?</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Select your primary business type. (Personal marketplace access is available
                      with a personal profile.)
                    </p>
                  </div>

                  <SellerSelectionStep
                    selected={currentProfile.sellerTags || []}
                    sellerType={currentProfile.sellerType}
                    onSubmit={handleSellerTagSelect}
                    onBack={() => setStep(3)}
                  />
                </div>
              )}

              {/* STEP 5: Add Another Profile */}
              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Profile Summary</h2>
                    <p className="text-sm text-slate-600 mt-1 mb-4">
                      {describeProfile(currentProfile as Profile)}
                    </p>

                    <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700">
                      <div>
                        <strong>Intent:</strong> {currentProfile.userIntent}
                      </div>
                      {currentProfile.businessType && (
                        <div>
                          <strong>Type:</strong> {currentProfile.businessType}
                        </div>
                      )}
                      {currentProfile.serviceTags && currentProfile.serviceTags.length > 0 && (
                        <div>
                          <strong>Services:</strong> {currentProfile.serviceTags.join(", ")}
                        </div>
                      )}
                      {currentProfile.sellerTags && currentProfile.sellerTags.length > 0 && (
                        <div>
                          <strong>Sells:</strong> {currentProfile.sellerTags.join(", ")}
                        </div>
                      )}
                      {currentProfile.sellerType && (
                        <div>
                          <strong>Seller Type:</strong> {currentProfile.sellerType}
                        </div>
                      )}
                    </div>
                  </div>

                  {profiles.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Your Profiles</h3>
                      <div className="space-y-2">
                        {profiles.map((p, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-slate-50 p-3 rounded-lg text-sm"
                          >
                            <span>{describeProfile(p)}</span>
                            <button
                              type="button"
                              onClick={() => removeProfile(i)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddAnotherProfile}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Another Profile
                    </Button>

                    <Button type="button" onClick={handleGoToReview} className="w-full">
                      Review & Create Account
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(2)}
                    className="w-full"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>
              )}

              {/* STEP 6: Review All Profiles */}
              {step === 6 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Review Your Profiles</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Each profile will verify independently.
                    </p>
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {profiles.map((p, i) => (
                      <div key={i} className="bg-slate-50 p-3 rounded-lg text-sm">
                        <div className="font-semibold text-slate-900">
                          {i + 1}. {describeProfile(p)}
                        </div>
                        <div className="text-slate-600 mt-1">{formatProfileDetails(p)}</div>
                        <button
                          type="button"
                          onClick={() => {
                            removeProfile(i);
                            if (profiles.length === 1) setStep(5);
                          }}
                          className="text-red-600 hover:text-red-700 text-xs mt-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Button
                      type="button"
                      onClick={handleSubmitSignup}
                      disabled={signupMutation.isPending}
                      className="w-full"
                    >
                      {signupMutation.isPending ? "Creating account..." : "Create Account & Verify"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(5)}
                      className="w-full"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sign In Link */}
          <p className="text-center text-sm text-slate-600 mt-6">
            Already have an account?{" "}
            <a
              href="/pre-scout-setup?mode=signin"
              className="text-blue-600 hover:underline font-medium"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ServiceSelectionStep({
  selected,
  onSubmit,
  onBack,
}: {
  selected: string[];
  onSubmit: (tags: string[]) => void;
  onBack: () => void;
}) {
  const [local, setLocal] = useState<string[]>(selected);

  const toggleTag = (tag: string) => {
    setLocal(local.includes(tag) ? local.filter((t) => t !== tag) : [...local, tag]);
  };

  return (
    <div className="space-y-5">
      {Object.entries(SERVICE_CATEGORIES).map(([category, items]) => (
        <div key={category}>
          <div className="text-sm font-semibold text-slate-700 mb-2 capitalize">
            {category.replace(/_/g, " ")}
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleTag(item.id)}
                className={`w-full text-left p-2 rounded border-2 transition flex items-center gap-2 ${
                  local.includes(item.id)
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Checkbox
                  checked={local.includes(item.id)}
                  onCheckedChange={() => toggleTag(item.id)}
                />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <Separator />

      <div className="space-y-3">
        <Button
          type="button"
          onClick={() => {
            if (local.length > 0) onSubmit(local);
            else {
              alert("Please select at least one service");
            }
          }}
          className="w-full"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>

        <Button type="button" variant="ghost" onClick={onBack} className="w-full">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    </div>
  );
}

function SellerSelectionStep({
  selected,
  sellerType,
  onSubmit,
  onBack,
}: {
  selected: string[];
  sellerType?: string;
  onSubmit: (tags: string[], type?: SellerType) => void;
  onBack: () => void;
}) {
  const [local, setLocal] = useState<string[]>(selected);
  const [localType, setLocalType] = useState<SellerType>((sellerType as SellerType) || "physical");

  const toggleTag = (tag: string) => {
    setLocal(local.includes(tag) ? local.filter((t) => t !== tag) : [...local, tag]);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold text-slate-700 mb-2">How Do You Sell?</div>
        <div className="space-y-2">
          {(["physical", "online", "hybrid"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setLocalType(type)}
              className={`w-full text-left p-2 rounded border-2 transition flex items-center gap-2 ${
                localType === type
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Checkbox checked={localType === type} onCheckedChange={() => setLocalType(type)} />
              <span className="text-sm capitalize">{type}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <div className="text-sm font-semibold text-slate-700 mb-2">
          Business Type (established business or retail)
        </div>
        {Object.entries(SELLER_CATEGORIES).map(([category, items]) => (
          <div key={category} className="mb-4">
            <div className="text-xs font-semibold text-slate-600 mb-2 capitalize">
              {category.replace(/_/g, " ")}
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleTag(item.id)}
                  className={`w-full text-left p-2 rounded border-2 transition flex items-center gap-2 ${
                    local.includes(item.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Checkbox
                    checked={local.includes(item.id)}
                    onCheckedChange={() => toggleTag(item.id)}
                  />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-3">
        <Button
          type="button"
          onClick={() => {
            if (local.length > 0) onSubmit(local, localType);
            else {
              alert("Please select at least one business type");
            }
          }}
          className="w-full"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>

        <Button type="button" variant="ghost" onClick={onBack} className="w-full">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    </div>
  );
}

function formatProfileDetails(p: Profile): string {
  const parts: string[] = [];
  if (p.serviceTags && p.serviceTags.length > 0) {
    parts.push(`Services: ${p.serviceTags.join(", ")}`);
  }
  if (p.sellerTags && p.sellerTags.length > 0) {
    parts.push(`Sells: ${p.sellerTags.join(", ")}`);
  }
  if (p.sellerType) {
    parts.push(`Type: ${p.sellerType}`);
  }
  return parts.join(" • ");
}
