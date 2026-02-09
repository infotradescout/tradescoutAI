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
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Facebook } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

const roleOptions = [
  "homeowner",
  "renter",
  "landlord",
  "property_manager",
  "business_owner",
  "restaurant_owner",
  "food_truck_owner",
  "bar_owner",
  "commercial_property",
  "franchise_owner",
  "startup_founder",
  "contractor",
  "handyman",
  "service_provider",
  "specialty_tradesperson",
  "designer",
  "inspector",
  "realtor",
  "mortgage_broker",
  "insurance_agent",
  "title_company",
  "car_dealer",
  "auto_service",
  "nonprofit_org",
  "affiliate",
  "content_creator",
  "other",
] as const;
type RoleOption = (typeof roleOptions)[number];

const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .refine(
        (value) => value.replace(/\D/g, "").length >= 10,
        "Please enter a valid phone number"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    userTypes: z.array(z.enum(roleOptions)).optional().default([]),
    userIntent: z.string().optional(),
    acceptTerms: z.boolean().refine((val) => val === true, "You must accept the Terms of Service"),
    allowPhoneCalls: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function CreateAccountPortal() {
  const { user, isAuthenticated, refetch } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [primaryFocus, setPrimaryFocus] = useState<"hire" | "offer" | "both">("hire");
  const [providers, setProviders] = useState<{ google: boolean; facebook: boolean }>({
    google: false,
    facebook: false,
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      userTypes: [],
      userIntent: "",
      acceptTerms: false,
      allowPhoneCalls: false,
    },
  });

  useEffect(() => {
    if (primaryFocus === "hire") {
      setValue("userTypes", ["homeowner"]);
      setValue("userIntent", "I need help hiring for local projects.");
      return;
    }
    if (primaryFocus === "offer") {
      setValue("userTypes", ["contractor"]);
      setValue("userIntent", "I offer services and want verified local work.");
      return;
    }
    setValue("userTypes", ["homeowner", "contractor"]);
    setValue("userIntent", "I both hire and provide services.");
  }, [primaryFocus, setValue]);

  // Fetch OAuth providers
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!alive) return;
        if (json && typeof json.google === "boolean" && typeof json.facebook === "boolean") {
          setProviders({ google: json.google, facebook: json.facebook });
          return;
        }
        setProviders({ google: false, facebook: false });
      })
      .catch(() => {
        if (!alive) return;
        setProviders({ google: false, facebook: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  // If the user is already signed in, route them appropriately
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const anyUser: any = user;
    const profileVersion: number =
      typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

    if (profileVersion <= 0) {
      navigate("/pre-scout-setup");
      return;
    }

    // Already normalized – send to Scout
    navigate("/scout?onboarding=true");
  }, [user, isAuthenticated, navigate]);

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      console.log("[CREATE_ACCOUNT] Submitting payload:", {
        email: data.email,
        userTypes: data.userTypes,
        hasPassword: !!data.password,
        hasPhone: !!data.phone,
        acceptTerms: data.acceptTerms,
      });

      return apiRequest("POST", "/api/auth/register", {
        email: data.email,
        phone: data.phone,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        userTypes: data.userTypes || [],
        userIntent: data.userIntent,
        acceptTerms: data.acceptTerms,
        allowPhoneCalls: data.allowPhoneCalls,
      });
    },
    onSuccess: () => {
      console.log("[CREATE_ACCOUNT] Registration successful");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      refetch?.();

      // Set Scout onboarding marker
      localStorage.setItem("scout_onboarding_marker", "__SCOUT_ONBOARDING__");

      toast({
        title: "Account created",
        description: "Welcome to TradeScout. Let's get you started.",
      });

      // CLAIM-FIRST: Route through the pre-Scout gate before Scout intent capture
      // No setTimeout - immediate redirect maintains flow authority
      navigate("/pre-scout-setup");
    },
    onError: (error: any) => {
      console.error("[CREATE_ACCOUNT] Registration failed:", error);
      const errorMessage =
        error?.message || error?.error || "Registration failed. Please try again.";

      // Recovery path: if user already exists, redirect to login with email pre-filled
      if (errorMessage.toLowerCase().includes("already exists")) {
        toast({
          title: "Account exists",
          description: "An account with this email already exists. Redirecting to login...",
        });
        setTimeout(() => {
          navigate("/login");
        }, 1500);
        return;
      }

      toast({
        title: "Signup failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    signupMutation.mutate(data);
  };

  return (
    <div className="h-full min-h-[calc(100dvh-var(--top-nav-h)-var(--bottom-nav-h))] bg-transparent flex items-start justify-center px-4 py-4 text-tsTextMain">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
              ACCOUNT SETUP
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Create your TradeScout account.
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              Join your local community in one step. Scout is your AI guide to everything happening
              nearby—deals, contractors, discussions, and more.
            </p>
          </div>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-tsTextMuted">
                  TRADESCOUT
                </span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-tsTextMain">Join TradeScout</CardTitle>
          </CardHeader>

          <CardContent>
            {/* OAuth Buttons */}
            <div className="space-y-3 mb-6">
              {providers.facebook && (
                <Button
                  type="button"
                  onClick={() => (window.location.href = "/api/auth/facebook")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6"
                >
                  <Facebook className="w-5 h-5 mr-3" />
                  Continue with Facebook
                </Button>
              )}

              {providers.google && (
                <Button
                  type="button"
                  onClick={() => (window.location.href = "/api/auth/google")}
                  variant="outline"
                  className="w-full border-tsBorder text-tsTextMain hover:bg-tsCard/80 font-medium py-6"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              )}
            </div>

            {/* Divider */}
            {(providers.facebook || providers.google) && (
              <div className="relative mb-6">
                <Separator className="bg-tsBorder" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-tsCard px-3 text-sm text-tsTextMuted">or</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm text-tsTextMain">
                  Email
                </Label>
                <Controller
                  name="email"
                  control={control}
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
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-sm text-tsTextMain">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                      />
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tsTextMuted hover:text-tsTextMain"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword" className="text-sm text-tsTextMain">
                  Confirm Password
                </Label>
                <div className="relative mt-1">
                  <Controller
                    name="confirmPassword"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                      />
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tsTextMuted hover:text-tsTextMain"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="firstName" className="text-sm text-tsTextMain">
                    First name
                  </Label>
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="firstName" placeholder="First" className="mt-1" />
                    )}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm text-tsTextMain">
                    Last name
                  </Label>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="lastName" placeholder="Last" className="mt-1" />
                    )}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone" className="text-sm text-tsTextMain">
                  Phone number
                </Label>
                <Controller
                  name="phone"
                  control={control}
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
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
                )}
              </div>
              {/* Primary Focus (Role-aware, not role-locked) */}
              <div>
                <Label className="text-sm text-tsTextMain mb-2 block">Primary focus</Label>
                <p className="text-xs text-tsTextMuted mb-3">
                  Pick one starting point. You can change this later in your profile.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrimaryFocus("hire")}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      primaryFocus === "hire"
                        ? "border-tsAccent bg-tsAccent/10"
                        : "border-tsBorder hover:border-tsAccent/60"
                    }`}
                  >
                    <div className="text-sm font-medium text-tsTextMain">I need help</div>
                    <div className="text-xs text-tsTextMuted">Hire verified pros for work.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryFocus("offer")}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      primaryFocus === "offer"
                        ? "border-tsAccent bg-tsAccent/10"
                        : "border-tsBorder hover:border-tsAccent/60"
                    }`}
                  >
                    <div className="text-sm font-medium text-tsTextMain">I offer services</div>
                    <div className="text-xs text-tsTextMuted">
                      Find verified local opportunities.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryFocus("both")}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      primaryFocus === "both"
                        ? "border-tsAccent bg-tsAccent/10"
                        : "border-tsBorder hover:border-tsAccent/60"
                    }`}
                  >
                    <div className="text-sm font-medium text-tsTextMain">I do both</div>
                    <div className="text-xs text-tsTextMuted">Hire and offer services.</div>
                  </button>
                </div>
                <p className="text-[11px] text-tsTextMuted mt-2">
                  Scout uses this as your initial routing signal. Full role details can be edited
                  later.
                </p>
              </div>

              {/* Terms & Permissions */}
              <div className="space-y-3 bg-tsBg/50 rounded-lg p-4 border border-tsBorder/50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Controller
                    name="acceptTerms"
                    control={control}
                    render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                  <div className="flex-1">
                    <span className="text-sm text-tsTextMain">
                      I accept the{" "}
                      <a href="/terms" target="_blank" className="text-tsAccent hover:underline">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="/privacy" target="_blank" className="text-tsAccent hover:underline">
                        Privacy Policy
                      </a>
                    </span>
                  </div>
                </label>
                {errors.acceptTerms && (
                  <p className="text-xs text-red-500">{errors.acceptTerms.message}</p>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <Controller
                    name="allowPhoneCalls"
                    control={control}
                    render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                  <div className="flex-1">
                    <span className="text-sm text-tsTextMuted">
                      I agree to receive phone calls from verified contractors (optional)
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={signupMutation.isPending}
                className="w-full mt-6 bg-tsAccent hover:bg-tsAccent/90 text-black font-semibold"
              >
                {signupMutation.isPending ? "Creating account..." : "Create account"}
              </Button>

              {/* Login Link */}
              <p className="text-xs text-tsTextMuted text-center mt-4">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-tsAccent hover:underline"
                >
                  Log in
                </button>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
