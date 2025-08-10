import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Facebook, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { AuthButtons } from "@/components/auth-buttons";

export default function Register() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // TODO: Implement email registration
      console.log("Email registration:", { email, password, firstName, lastName });
      // After successful registration, redirect to profile setup
      setLocation('/profile-setup');
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Back to Landing */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6 text-gray-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <Card className="bg-navy-800 border-navy-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl">Create Your Account</CardTitle>
            <CardDescription className="text-gray-300">
              Join Trade Scout and connect with the best contractors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Social Registration Options */}
            <div className="space-y-3">
              <Button
                onClick={() => window.location.href = "/api/auth/facebook"}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-base"
              >
                <Facebook className="w-5 h-5 mr-3" />
                Sign up with Facebook
              </Button>
              
              <Button
                onClick={() => window.location.href = "/api/auth/google"}
                variant="outline"
                className="w-full border-gray-600 text-gray-200 hover:bg-gray-700 font-medium py-6 text-base"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <Separator className="bg-navy-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-navy-800 px-3 text-sm text-gray-400">or</span>
              </div>
            </div>

            {/* Email Registration Form */}
            <form onSubmit={handleEmailRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-gray-300">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="form-field mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="form-field mt-1"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-field mt-1"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-field mt-1"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-6 text-base"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            {/* Login Link */}
            <div className="text-center">
              <span className="text-gray-400">Already have an account? </span>
              <Button
                variant="link"
                onClick={() => setLocation("/login")}
                className="text-orange-400 hover:text-orange-300 p-0"
              >
                Sign in
              </Button>
            </div>

            {/* Terms */}
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              By creating an account, you agree to Trade Scout's{" "}
              <a href="/terms" className="text-orange-400 hover:text-orange-300">Terms of Service</a>{" "}
              and{" "}
              <a href="/privacy" className="text-orange-400 hover:text-orange-300">Privacy Policy</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}