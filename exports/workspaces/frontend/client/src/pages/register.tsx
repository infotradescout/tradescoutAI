import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { UserPlus, Mail, Lock, User, MapPin, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import UserTypeSelect from "@/components/UserTypeSelect";
import { StateCountySelector } from "@/components/state-county-selector";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be less than 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: z.string().email("Please enter a valid email address"),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .refine(
        (value) => value.replace(/\D/g, "").length >= 10,
        "Please enter a valid phone number"
      ),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    address: z.string().min(5, "Please enter your address for neighborhood verification"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    county: z.string().optional(),
    userTypes: z.array(z.string()).min(1, "Please select at least one user type"),
    acceptTerms: z.boolean().refine((val) => val === true, "You must accept the Terms of Service"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [location, navigate] = useLocation();
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  const beginOAuth = (provider: "google" | "facebook") => {
    window.location.assign(`${apiBaseUrl}/api/auth/${provider}`);
  };

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      address: "",
      city: "",
      state: "",
      county: "",
      userTypes: [],
      acceptTerms: false,
    },
  });

  // State/county selection is handled via StateCountySelector, which
  // uses the canonical /api/states and /api/counties endpoints.
  const [selectedCountyFips, setSelectedCountyFips] = useState("");
  const [selectedCountyName, setSelectedCountyName] = useState("");

  const createdViaScout = (() => {
    try {
      const query = location.split("?")[1] || "";
      const params = new URLSearchParams(query);
      const source = (params.get("source") || params.get("via") || "").toLowerCase();
      return source === "scout";
    } catch {
      return false;
    }
  })();

  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterFormData, "confirmPassword">) => {
      const stateCode = String(data.state || "")
        .trim()
        .toUpperCase();
      let resolvedCountyFips = String(selectedCountyFips || "").trim();
      let resolvedCountyName = String(selectedCountyName || data.county || "").trim();

      // Allow county selection to be skipped by inferring from city + state.
      if (!resolvedCountyFips && data.city.trim().length >= 2 && /^[A-Z]{2}$/.test(stateCode)) {
        try {
          const params = new URLSearchParams({
            city: data.city.trim(),
            state: stateCode,
          });
          const inferRes = await fetch(`/api/counties/infer?${params.toString()}`);
          if (inferRes.ok) {
            const inferred = await inferRes.json();
            if (inferred?.inferred?.countyFips) {
              resolvedCountyFips = String(inferred.inferred.countyFips).trim();
              resolvedCountyName = String(inferred.inferred.countyName || "").trim();
            }
          }
        } catch {
          // Fail-soft: server-side registration also attempts county inference.
        }
      }

      const payload: any = {
        ...data,
        // Include canonical location fields
        stateCode, // StateCountySelector sets 'state' to the stateCode
        countyFips: resolvedCountyFips || undefined,
        countyName: resolvedCountyName || undefined,
      };
      if (createdViaScout) {
        payload.source = "scout";
      }
      const response = await apiRequest("POST", "/api/auth/register", payload);
      return response;
    },
    onSuccess: () => {
      // Persist location to localStorage for immediate availability
      try {
        if (form.getValues("state") && selectedCountyFips) {
          window.localStorage.setItem(
            "userLocation",
            JSON.stringify({
              stateCode: form.getValues("state"),
              countyFips: selectedCountyFips,
              countyName: selectedCountyName || form.getValues("county"),
            })
          );
        }
      } catch {
        // Ignore localStorage errors
      }

      toast({
        title: "Account created successfully",
        description: "Welcome to TradeScout! Next, set up your profile and colors.",
      });
      // New accounts should land on profile setup, same as first-time social logins
      navigate("/profile-settings?onboarding=1");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData);
  };

  return (
    <div className="flex items-center justify-center px-4 py-8 text-white font-body">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6 order-2 lg:order-1">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1">
              <span className="text-sm font-medium text-ts-orange uppercase tracking-[0.18em]">
                PROFILE OS
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              One account. Every role you play in the community.
            </h1>
            <p className="text-sm md:text-base text-white/60 max-w-xl">
              Pick your user types (homeowner, contractor, realtor, restaurant owner, community
              builder and more). Your profile becomes your website - Scout handles the routing,
              tools, and trust badges.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-white/60">
              <div className="space-y-1">
                <p className="font-semibold text-white text-sm">Multi-role support</p>
                <p>
                  Check every hat you wear: contractor, realtor, landlord, organizer, affiliate, and
                  more.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-white text-sm">County-first identity</p>
                <p>
                  We tie your roles to where you live so locals know exactly who they’re dealing
                  with.
                </p>
              </div>
            </div>
          </div>

          <div className="hidden lg:block bg-tsCard border border-white/10 rounded-xl p-4 text-xs text-white/60 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
            <p className="mb-2 font-semibold text-white">What happens after signup?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Choose your colors and profile layout.</li>
              <li>
                Toggle which sections appear on your public profile (About, services,
                recommendations, and more).
              </li>
              <li>Connect Marketplace, Community, and any future roles under one profile URL.</li>
            </ul>
          </div>
        </div>

        <Card className="bg-tsCard border border-white/10 rounded-xl shadow-[0_18px_52px_rgba(0,0,0,0.36)] order-1 lg:order-2">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="font-display text-2xl font-extrabold text-white">
              Join TradeScout
            </CardTitle>
            <p className="text-sm text-white/60">
              Create your account and choose your user types to personalize your experience.
            </p>
          </CardHeader>

          <CardContent>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-5">
              <div className="text-sm text-white/60">Continue with</div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 font-semibold transition-all"
                  onClick={() => beginOAuth("google")}
                >
                  Google
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 font-semibold transition-all"
                  onClick={() => beginOAuth("facebook")}
                >
                  Facebook
                </button>
              </div>
              <div className="mt-3 text-xs text-white/50">
                Or create an account with email below.
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" method="post">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    First name
                  </Label>
                  <Input
                    id="firstName"
                    {...form.register("firstName")}
                    className="mt-1"
                    placeholder="John"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="lastName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Last name
                  </Label>
                  <Input
                    id="lastName"
                    {...form.register("lastName")}
                    className="mt-1"
                    placeholder="Doe"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Username
                  </Label>
                  <Input
                    id="username"
                    {...form.register("username")}
                    className="mt-1"
                    placeholder="john_doe"
                  />
                  {form.formState.errors.username && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    className="mt-1"
                    placeholder="john@example.com"
                  />
                  {form.formState.errors.email && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  {...form.register("phone")}
                  className="mt-1"
                  placeholder="(555) 555-5555"
                />
                {form.formState.errors.phone && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.phone.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    {...form.register("address")}
                    className="mt-1"
                    placeholder="123 Main St"
                  />
                  <p className="text-xs text-white/50 mt-1">
                    For neighborhood verification and local content relevance.
                  </p>
                  {form.formState.errors.address && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.address.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="city" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    City
                  </Label>
                  <Input
                    id="city"
                    {...form.register("city")}
                    className="mt-1"
                    placeholder="Austin"
                  />
                  {form.formState.errors.city && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.city.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div />
                <div>
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    State / County
                  </Label>
                  <div className="mt-1">
                    <StateCountySelector
                      selectedState={form.watch("state")}
                      selectedCounty={selectedCountyFips}
                      onStateChange={(stateCode) => {
                        form.setValue("state", stateCode, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                        // Reset county whenever state changes
                        setSelectedCountyFips("");
                        form.setValue("county", "", { shouldValidate: true, shouldDirty: true });
                      }}
                      onCountyChange={(countyFips) => {
                        setSelectedCountyFips(countyFips);
                      }}
                      onCountySelected={(county) => {
                        setSelectedCountyName(county?.name || "");
                        form.setValue("county", county?.name || "", {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                    />
                  </div>
                  {form.formState.errors.state && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.state.message}
                    </p>
                  )}
                  {form.formState.errors.county && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.county.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-white/50 mt-1">
                  We use your state and county for neighborhood verification, local feeds, and
                  matching. If you skip county, TradeScout will auto-detect it from city and state.
                </p>
              </div>

              <div className="my-6">
                <Controller
                  name="userTypes"
                  control={form.control}
                  render={({ field }) => (
                    <UserTypeSelect selectedTypes={field.value || []} onChange={field.onChange} />
                  )}
                />
                {form.formState.errors.userTypes && (
                  <p className="text-red-400 text-sm mt-2">
                    {form.formState.errors.userTypes.message}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 text-sm">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-white/10 bg-white/5 text-ts-orange focus:ring-ts-orange"
                  {...form.register("acceptTerms")}
                />
                <Label htmlFor="acceptTerms" className="text-xs text-white/60 leading-relaxed">
                  I agree to the{" "}
                  <a href="/terms" className="underline" target="_blank" rel="noreferrer">
                    Terms of Service
                  </a>
                  .
                </Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...form.register("password")}
                    className="mt-1"
                    placeholder="Create a strong password"
                  />
                  {form.formState.errors.password && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Confirm password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    {...form.register("confirmPassword")}
                    className="mt-1"
                    placeholder="Re-enter your password"
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Creating account..." : "Create account"}
              </Button>

              <div className="mt-6 text-center">
                <p className="text-sm text-white/60">
                  Already have an account?{" "}
                  <Link
                    href="/pre-scout-setup?mode=signin"
                    className="text-ts-orange hover:text-ts-orange-light font-medium"
                  >
                    Sign in here
                  </Link>
                  .
                </p>
              </div>

              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-xs text-white/60">
                  <strong className="text-white">Why join TradeScout?</strong> Your profile replaces
                  a website: colors, roles, and your area are all baked in. Scout uses this to tune
                  marketplace matches, community visibility, and future tools for whatever roles you
                  pick - homeowner, pro, organizer, affiliate, or any new roles we add later.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
