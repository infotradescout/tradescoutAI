import React, { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, UserPlus, Mail, Lock, User, MapPin } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import UserTypeSelect from "@/components/UserTypeSelect";
import { US_STATES, getCountiesForState } from "@shared/us-states-counties";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be less than 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    address: z.string().min(5, "Please enter your address for neighborhood verification"),
    state: z.string().min(2, "State is required"),
    county: z.string().min(2, "County is required"),
    userTypes: z.array(z.string()).min(1, "Please select at least one user type"),
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

  const beginOAuth = (provider: "google" | "facebook") => {
    window.location.assign(`/api/auth/${provider}`);
  };

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      address: "",
      state: "",
      county: "",
      userTypes: [],
    },
  });

  const stateCode = form.watch("state");

  const countiesForState = useMemo(() => {
    if (!stateCode) return [];
    return getCountiesForState(stateCode) || [];
  }, [stateCode]);

  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterFormData, "confirmPassword">) => {
      const response = await apiRequest("POST", "/auth/register", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Account created successfully",
        description: "Welcome to TradeScout! Next, set up your profile and colors.",
      });
      window.location.href = "/profile-setup";
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1e] via-[#020617] to-[#020617] flex items-center justify-center px-4 py-10 text-tsTextMain">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <Link href="/">
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-tsTextMuted hover:text-white hover:bg-white/5 pl-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Scout
            </Button>
          </Link>

          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
              PROFILE OS
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              One account. Every role you play in the community.
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              Pick your user types (homeowner, contractor, realtor, restaurant owner, community builder and more).
              Your profile becomes your websiteScout handles the routing, tools, and trust badges.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-tsTextMuted">
              <div className="space-y-1">
                <p className="font-semibold text-tsTextMain text-sm">Multi-role support</p>
                <p>
                  Check every hat you wear: contractor, realtor, landlord, organizer, affiliate, and more.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-tsTextMain text-sm">County-first identity</p>
                <p>
                  We tie your roles to where you live so locals know exactly who they&apos;re dealing with.
                </p>
              </div>
            </div>
          </div>

          <div className="hidden lg:block rounded-2xl border border-tsBorder bg-black/30 p-4 text-xs text-tsTextMuted">
            <p className="mb-2 font-semibold text-tsTextMain">What happens after signup?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Choose your colors and profile layout.</li>
              <li>
                Toggle which sections appear on your public profile (About, services, reviews, and more).
              </li>
              <li>Connect Marketplace, Community, and any future roles under one profile URL.</li>
            </ul>
          </div>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-tsTextMain">Join TradeScout</CardTitle>
            <p className="text-sm text-tsTextMuted">
              Create your account and choose your user types to personalize your experience.
            </p>
          </CardHeader>

          <CardContent>
            <div className="bg-[#0b1224] border border-tsBorder rounded-xl p-4 mb-5">
              <div className="text-sm text-slate-300">Continue with</div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800"
                  onClick={() => beginOAuth("google")}
                >
                  Google
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800"
                  onClick={() => beginOAuth("facebook")}
                >
                  Facebook
                </button>
              </div>
              <div className="mt-3 text-xs text-tsTextMuted">
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
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.firstName.message}</p>
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
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.lastName.message}</p>
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
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.username.message}</p>
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
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>
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
                  <p className="text-xs text-tsTextMuted mt-1">
                    For neighborhood verification and local content relevance.
                  </p>
                  {form.formState.errors.address && (
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.address.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="state" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    State / Territory
                  </Label>
                  <select
                    id="state"
                    {...form.register("state")}
                    className="mt-1 w-full rounded-md border border-tsBorder bg-tsBg px-3 py-2 text-sm text-tsTextMain"
                  >
                    <option value="">Select state or territory</option>
                    {US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.state && (
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.state.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="county" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  County / Parish / Borough
                </Label>
                <select
                  id="county"
                  {...form.register("county")}
                  className="mt-1 w-full rounded-md border border-tsBorder bg-tsBg px-3 py-2 text-sm text-tsTextMain"
                  disabled={!stateCode || countiesForState.length === 0}
                >
                  <option value="">{stateCode ? "Select county" : "Select a state first"}</option>
                  {countiesForState.map((c) => (
                    <option key={c.fips} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-tsTextMuted mt-1">
                  Used for local community matching and recommendations.
                </p>
                {form.formState.errors.county && (
                  <p className="text-red-400 text-sm mt-1">{form.formState.errors.county.message}</p>
                )}
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
                  <p className="text-red-400 text-sm mt-2">{form.formState.errors.userTypes.message}</p>
                )}
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
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.password.message}</p>
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
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Creating account..." : "Create account"}
              </Button>

              <div className="mt-6 text-center">
                <p className="text-sm text-tsTextMuted">
                  Already have an account?{" "}
                  <Link href="/login" className="text-tsAccent hover:text-orange-400 font-medium">
                    Sign in here
                  </Link>
                  .
                </p>
              </div>

              <div className="mt-4 p-4 bg-[#0b1224] border border-tsBorder rounded-lg">
                <p className="text-xs text-tsTextMuted">
                  <strong className="text-tsTextMain">Why join TradeScout?</strong>{" "}
                  Your profile replaces a website: colors, roles, and your area are all baked in. Scout uses this to tune
                  marketplace matches, community visibility, and future tools for whatever roles you pickhomeowner,
                  pro, organizer, affiliate, or any new roles we add later.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}