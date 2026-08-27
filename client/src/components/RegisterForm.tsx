import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { FacebookBrandIcon } from "@/components/icons/BrandIcons";
import { formatUserFacingErrorMessage, getRawErrorMessage } from "@/lib/userFacingError";

const roleOptions = ["homeowner", "contractor", "realtor", "car_dealer"] as const;
type RoleOption = (typeof roleOptions)[number];

const registerSchema = z
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
    // Primary role is derived from userTypes[0] on submit; keep role optional for backward compatibility
    role: z.enum(roleOptions).optional(),
    userTypes: z
      .array(z.enum(roleOptions))
      .min(1, "Please select at least one way you plan to use TradeScout"),
    acceptTerms: z.boolean().refine((val) => val === true, "You must accept the Terms of Service"),
    allowPhoneCalls: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ""
  ).replace(/\/$/, "");

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      userTypes: [],
      acceptTerms: false,
      allowPhoneCalls: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterFormData, "confirmPassword">) => {
      try {
        console.log("[REGISTER] Submitting payload:", {
          email: data.email,
          userTypes: data.userTypes,
          hasPassword: !!data.password,
          hasPhone: !!data.phone,
          acceptTerms: data.acceptTerms,
        });
        return await apiRequest("POST", "/api/auth/register", data);
      } catch (error: any) {
        console.error("[REGISTER] Request failed:", {
          message: error.message,
          error: error,
          stack: error.stack,
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("[REGISTER] Success, user created");
      if ((data as any)?.user) {
        queryClient.setQueryData(["/api/auth/user"], (data as any).user);
      }
      toast({
        title: "Welcome to TradeScout!",
        description: "Your account has been created successfully.",
      });
      try {
        // Seed Scout with a one-time onboarding marker so the first
        // visit to /scout can offer the "What are you here to do today?"
        // chooser without asking the user to type.
        window.localStorage.setItem("scout:prefill:scout-main", "__SCOUT_ONBOARDING__");
      } catch {
        // ignore storage errors
      }
      // Invalidate user query to refetch current user
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("[REGISTER] Mutation error:", {
        message: error.message,
        error: error,
      });

      const rawMessage = getRawErrorMessage(error).toLowerCase();
      let errorDescription = formatUserFacingErrorMessage(
        error,
        "Unable to create account. Please try again."
      );

      // Check for common validation errors
      if (rawMessage.includes("email")) {
        errorDescription = "Please check your email address.";
      } else if (rawMessage.includes("password")) {
        errorDescription =
          "Password must be at least 8 characters with uppercase, lowercase, and number.";
      } else if (rawMessage.includes("phone")) {
        errorDescription = "Please enter a valid phone number.";
      } else if (rawMessage.includes("terms")) {
        errorDescription = "You must accept the Terms of Service.";
      } else if (rawMessage.includes("already exists")) {
        errorDescription = "An account with this email already exists. Try logging in instead.";
      }

      toast({
        title: "Registration Failed",
        description: errorDescription,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    const primaryRole: RoleOption = data.userTypes[0];
    const { confirmPassword, ...rest } = data;

    const registerData = {
      ...rest,
      role: primaryRole,
      userTypes: data.userTypes,
    };

    registerMutation.mutate(registerData);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          You're signing up to claim and verify — not to browse contacts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your.email@example.com" required {...field} />
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
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 555-5555" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="userTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How do you plan to use TradeScout? (Select all that apply)</FormLabel>
                  <div className="space-y-2">
                    {[
                      {
                        value: "homeowner" as RoleOption,
                        label: "Use TradeScout for my own projects",
                      },
                      {
                        value: "contractor" as RoleOption,
                        label: "Offer services or run a business",
                      },
                      {
                        value: "realtor" as RoleOption,
                        label: "Work with property, housing, or real estate",
                      },
                      {
                        value: "car_dealer" as RoleOption,
                        label: "Work with vehicles, transport, or equipment",
                      },
                    ].map((option) => {
                      const checked = field.value?.includes(option.value) ?? false;
                      return (
                        <div
                          key={option.value}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(isChecked) => {
                                const current: RoleOption[] = field.value || [];
                                if (isChecked) {
                                  field.onChange([...current, option.value]);
                                } else {
                                  field.onChange(current.filter((v) => v !== option.value));
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-normal">{option.label}</FormLabel>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        required
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        required
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      By creating an account, I agree to the{" "}
                      <a href="/terms" className="underline" target="_blank" rel="noreferrer">
                        Terms of Service
                      </a>{" "}
                      and acknowledge the{" "}
                      <a href="/privacy" className="underline" target="_blank" rel="noreferrer">
                        Privacy Policy
                      </a>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowPhoneCalls"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      I agree that TradeScout may contact me by phone about my account and activity.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </Form>

        {/* Social Login Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or sign up with</span>
          </div>
        </div>

        {/* Facebook Signup Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full mb-4"
          onClick={() => (window.location.href = `${apiBaseUrl}/api/auth/facebook`)}
          data-testid="button-facebook-signup"
        >
          <FacebookBrandIcon className="mr-2 h-4 w-4 text-blue-600" />
          Sign up with Facebook
        </Button>

        {onSwitchToLogin && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button variant="link" className="p-0 h-auto" onClick={onSwitchToLogin}>
                Sign in
              </Button>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
