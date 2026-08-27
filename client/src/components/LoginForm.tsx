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
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { FacebookBrandIcon, GoogleBrandIcon } from "@/components/icons/BrandIcons";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      try {
        return await apiRequest("POST", "/api/auth/login", data);
      } catch (error) {
        console.error("Login request failed:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });
      // Invalidate user query to refetch current user
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      const code = typeof error?.code === "string" ? error.code : "";
      const description =
        code === "AUTH_NO_ACCOUNT"
          ? "No account found for that email. Create one, or find your business profile and claim it."
          : code === "AUTH_INCORRECT_PASSWORD"
            ? "Incorrect password. Please try again."
            : code === "AUTH_SOCIAL_ONLY"
              ? "This account uses Google/Facebook sign-in."
              : formatUserFacingErrorMessage(
                  error,
                  "Unable to sign in. Please check your credentials and try again."
                );
      toast({
        title: "Login Failed",
        description,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Welcome back to TradeScout</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
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

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </Form>

        {/* Social Login Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        {/* Google Login Button */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => (window.location.href = buildApiUrl("/api/auth/google"))}
            data-testid="button-google-login"
          >
            <GoogleBrandIcon className="mr-2 h-4 w-4 text-red-500" />
            Continue with Google
          </Button>

          {/* Facebook Login Button (hidden when DISABLE_FACEBOOK_AUTH=true) */}
          {import.meta.env.VITE_DISABLE_FACEBOOK_AUTH !== "true" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = buildApiUrl("/api/auth/facebook"))}
              data-testid="button-facebook-login"
            >
              <FacebookBrandIcon className="mr-2 h-4 w-4 text-blue-600" />
              Continue with Facebook
            </Button>
          )}
        </div>

        {onSwitchToRegister && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button variant="link" className="p-0 h-auto" onClick={onSwitchToRegister}>
                Sign up
              </Button>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
