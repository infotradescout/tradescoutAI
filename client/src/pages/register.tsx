import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { ArrowLeft, UserPlus, Mail, Lock, User, MapPin, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  role: z.enum(['homeowner', 'contractor_user', 'helper', 'realtor', 'dealer', 'service_provider']).default('homeowner'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Get role from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const defaultRole = urlParams.get('role') as 'homeowner' | 'contractor_user' | 'helper' | 'realtor' | 'dealer' | 'service_provider' || 'homeowner';

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
      role: defaultRole,
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterFormData, "confirmPassword">) => {
      const response = await apiRequest('POST', '/auth/register', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account Created Successfully!",
        description: "Welcome to TradeScout! You can now participate in community moderation.",
      });
      // Redirect based on role
      const role = form.getValues('role');
      if (role === 'helper') {
        window.location.href = '/helper-dashboard';
      } else if (role === 'contractor_user') {
        window.location.href = '/contractor-dashboard';
      } else if (role === 'realtor') {
        window.location.href = '/realtor-dashboard';
      } else if (role === 'dealer' || role === 'service_provider') {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/homeowner-dashboard';
      }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Back to Demo Button */}
        <div className="mb-6">
          <Link href="/community/moderation">
            <Button variant="ghost" className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <ArrowLeft className="h-4 w-4" />
              Back to Demo
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Join TradeScout</CardTitle>
            <p className="text-gray-600 dark:text-gray-400">
              Create your account to participate in community moderation
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" method="post">
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
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.firstName.message}</p>
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
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

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
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.username.message}</p>
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
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </Label>
                <Input
                  id="address"
                  {...form.register("address")}
                  className="mt-1"
                  placeholder="123 Main St, Your City, State 12345"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  For neighborhood verification and local content relevance
                </p>
                {form.formState.errors.address && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.address.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Account Type
                </Label>
                <Select value={form.watch("role")} onValueChange={(value) => form.setValue("role", value as any)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select your account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homeowner">Homeowner - Find contractors and services</SelectItem>
                    <SelectItem value="contractor_user">Contractor - Offer professional services</SelectItem>
                    <SelectItem value="helper">Helper - Provide task assistance</SelectItem>
                    <SelectItem value="realtor">Realtor - Real estate professional</SelectItem>
                    <SelectItem value="dealer">Dealer - Equipment and material supplier</SelectItem>
                    <SelectItem value="service_provider">Service Provider - Business services</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Choose the type that best describes how you'll use TradeScout
                </p>
                {form.formState.errors.role && (
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.role.message}</p>
                )}
              </div>

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
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.password.message}</p>
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
                  <p className="text-red-500 text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || registerMutation.isPending}
              >
                {isLoading || registerMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                  Sign in here
                </Link>
              </p>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Why join?</strong> Participate in community voting, help moderate neighborhood content, 
                and build reputation as a trusted community member.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}