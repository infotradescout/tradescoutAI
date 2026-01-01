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
import { StateCountySelector } from "@/components/state-county-selector";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  state: z.string().min(2, "State is required"),
  county: z.string().min(2, "County is required"),
  roleIntent: z.enum(["homeowner", "contractor", "other"]),
}).refine((data) => data.password === data.confirmPassword, {
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

  const { control, handleSubmit, formState: { errors }, watch } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      roleIntent: "homeowner",
    },
  });

  const stateValue = watch("state");
  const countyValue = watch("county");

  // If the user is already signed in, route them appropriately
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const anyUser: any = user;
    const profileVersion: number = typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

    if (profileVersion <= 0) {
      navigate("/onboarding/intent");
      return;
    }

    // Already normalized – send to Scout
    navigate("/scout?onboarding=true");
  }, [user, isAuthenticated, navigate]);

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      return apiRequest("POST", "/api/auth/register", {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        stateCode: data.state,
        countyFips: data.county,
        roleIntent: data.roleIntent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      refetch?.();
      toast({
        title: "Account created",
        description: "Welcome to TradeScout. Let's set up your profile.",
      });
      // Route to intent if contractor, else straight to Scout
      setTimeout(() => {
        const roleIntent = watch("roleIntent");
        navigate(roleIntent === "contractor" ? "/onboarding/intent" : "/scout?onboarding=true");
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    signupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-tsBg via-slate-950 to-tsBg flex items-center justify-center px-4 py-10 text-tsTextMain">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/community-feed")}
            className="flex items-center gap-2 text-tsTextMuted hover:text-white hover:bg-white/5 pl-0"
          >
            <span className="text-sm">Skip and browse as guest</span>
          </Button>

          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
              ACCOUNT SETUP
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Create your TradeScout account.
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              Join your local community in one step. Scout is your AI guide to everything happening nearby—deals, contractors, discussions, and more.
            </p>

            <div className="rounded-2xl border border-tsBorder bg-black/30 p-4 text-xs text-tsTextMuted">
              <p className="mb-2 font-semibold text-tsTextMain">Why we ask for your location</p>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="text-tsTextMain font-medium">See local activity:</span> Find contractors, deals, and discussions in your area.</li>
                <li><span className="text-tsTextMain font-medium">Trusted connections:</span> Get recommendations from neighbors, not algorithms.</li>
                <li><span className="text-tsTextMain font-medium">Relevant results:</span> Scout shows you what actually matters nearby.</li>
              </ul>
            </div>
          </div>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-tsTextMuted">TRADESCOUT</span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-tsTextMain">
              Join TradeScout
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm text-tsTextMain">Email</Label>
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
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-sm text-tsTextMain">Password</Label>
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
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword" className="text-sm text-tsTextMain">Confirm Password</Label>
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
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="firstName" className="text-sm text-tsTextMain">First name</Label>
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="firstName" placeholder="First" className="mt-1" />
                    )}
                  />
                  {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm text-tsTextMain">Last name</Label>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="lastName" placeholder="Last" className="mt-1" />
                    )}
                  />
                  {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
                </div>
              </div>

              {/* Location */}
              <div>
                <Label className="text-sm text-tsTextMain">Where are you active?</Label>
                <div className="mt-1">
                  <Controller
                    name="state"
                    control={control}
                    render={({ field }) => (
                      <Controller
                        name="county"
                        control={control}
                        render={({ field: countyField }) => (
                          <StateCountySelector
                            stateCode={field.value}
                            onStateChange={field.onChange}
                            countyFips={countyField.value}
                            onCountyChange={countyField.onChange}
                          />
                        )}
                      />
                    )}
                  />
                </div>
                {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>}
                {errors.county && <p className="text-xs text-red-500 mt-1">{errors.county.message}</p>}
              </div>

              {/* Role Intent */}
              <div>
                <Label className="text-sm text-tsTextMain">What describes you best?</Label>
                <div className="mt-2 space-y-2">
                  {[
                    { value: "homeowner", label: "Homeowner or resident" },
                    { value: "contractor", label: "Contractor or service provider" },
                    { value: "other", label: "Other" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <Controller
                        name="roleIntent"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="radio"
                            value={option.value}
                            checked={field.value === option.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-4 h-4"
                          />
                        )}
                      />
                      <span className="text-sm text-tsTextMain">{option.label}</span>
                    </label>
                  ))}
                </div>
                {errors.roleIntent && <p className="text-xs text-red-500 mt-1">{errors.roleIntent.message}</p>}
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
