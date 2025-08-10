import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Facebook, Mail, Eye, EyeOff, Building } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      return apiRequest('POST', '/auth/login', data);
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You've been successfully logged in.",
      });
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      setError(error.message || 'Login failed. Please check your credentials.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate(formData);
  };

  const handleSocialLogin = (provider: 'facebook' | 'google') => {
    window.location.href = `/auth/${provider}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-navy-800 border-navy-600">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <Building className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Welcome Back</CardTitle>
          <p className="text-gray-300">Sign in to your Trade Scout account</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Social Login Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-[#1877F2] border-[#1877F2] text-white hover:bg-[#166FE5]"
              onClick={() => handleSocialLogin('facebook')}
            >
              <Facebook className="h-4 w-4 mr-2" />
              Continue with Facebook
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={() => handleSocialLogin('google')}
            >
              <Mail className="h-4 w-4 mr-2" />
              Continue with Google
            </Button>
          </div>

          <div className="relative">
            <Separator className="bg-navy-600" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-navy-800 px-2 text-sm text-gray-400">
              or sign in with email
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="bg-red-900/20 border-red-500/50">
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}
            
            <div>
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                placeholder="Enter your email"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="bg-navy-700 border-navy-600 text-white placeholder-gray-400 pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-gray-400 text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-orange-500 hover:text-orange-400">
                Sign up
              </Link>
            </p>
            <p className="text-gray-400 text-sm">
              <Link href="/forgot-password" className="text-orange-500 hover:text-orange-400">
                Forgot your password?
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}