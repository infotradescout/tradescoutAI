import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, UserPlus, Mail, Lock, User, MapPin } from "lucide-react";
import UserTypeSelect from "@/components/UserTypeSelect";
import { US_STATES, SAMPLE_COUNTIES, getCountiesForState } from "@shared/us-states-counties";

const registerSchema = z.object({
  username: z.string()
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
  county: z.string().min(2, "County is required for founder badge eligibility"),
  userTypes: z.array(z.string()).min(1, "Please select at least one user type"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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

  const countiesForState = useMemo(() => {
    if (!form.watch("state")) return [];
    const stateCode = form.watch("state");
    return getCountiesForState(stateCode) || [];
  }, [form]);

  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterFormData, "confirmPassword">) => {
      const response = await apiRequest('POST', '/auth/register', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Created Successfully!",
        description: "Welcome to TradeScout! You can now personalize your profile and colors.",
      });
      window.location.href = '/community/moderation';
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    setIsLoading(true);
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1e] via-[#0f172a] to-[#0a0f1e] flex items-center justify-center px-4 py-10 text-tsTextMain">
      <div className="max-w-2xl w-full">
        <div className="mb-6 flex justify-between items-center">
          <Link href="/community/moderation">
            <Button variant="ghost" className="flex items-center gap-2 text-tsTextMuted hover:text-white hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" />
              Back to Demo
            </Button>
          </Link>
          <p className="text-xs text-tsTextMuted">Your profile is your website. Pick your types + colors after signup.</p>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-tsAccent to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-tsTextMain">Join TradeScout</CardTitle>
            <p className="text-sm text-tsTextMuted">
              Create your account and choose your user types to personalize your experience.
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" method="post">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    First Name
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
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    {...form.register("lastName")}
                    className="mt-1"
                    placeholder="Smith"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Username
                  </Label>
                  <Input
                    id="username"
                    {...form.register("username")}
                    className="mt-1"
                    placeholder="johnsmith123"
                  />
                  {form.formState.errors.username && (
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.username.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
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
                    For neighborhood verification and local content relevance
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
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
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
                  disabled={!form.watch("state") || countiesForState.length === 0}
                >
                  <option value="">{form.watch("state") ? "Select county" : "Select a state first"}</option>
                  {countiesForState.map((c) => (
                    <option key={c.fips} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-tsTextMuted mt-1">
                  Helps us issue Founder badges for the first user type in each county.
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
                    <UserTypeSelect
                      selectedTypes={field.value || []}
                      onChange={field.onChange}
                    />
                  )}
                />
                {form.formState.errors.userTypes && (
                  <p className="text-red-400 text-sm mt-2">{form.formState.errors.userTypes.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    {...form.register("password")}
                    className="mt-1"
                    placeholder="Enter your password"
                  />
                  {form.formState.errors.password && (
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...form.register("confirmPassword")}
                    className="mt-1"
                    placeholder="Confirm your password"
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="text-red-400 text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-tsAccent hover:bg-orange-500 text-white"
                disabled={isLoading || registerMutation.isPending}
              >
                {isLoading || registerMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-tsTextMuted">
                Already have an account?{" "}
                <Link href="/login" className="text-tsAccent hover:text-orange-400 font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
            <div className="mt-4 p-4 bg-[#0b1224] border border-tsBorder rounded-lg">
              <p className="text-xs text-tsTextMuted">
                <strong className="text-tsTextMain">Why join?</strong> Participate in community voting, help moderate neighborhood content, 
                and build reputation as a trusted community member. Your profile becomes your website with your colors and user types.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}