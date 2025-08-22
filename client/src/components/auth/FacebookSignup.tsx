import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Facebook, Shield, Users, Star, CheckCircle } from "lucide-react";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";

interface FacebookSignupProps {
  onFacebookSignup: () => void;
  onSkipToRegular?: () => void;
}

export function FacebookSignup({ onFacebookSignup, onSkipToRegular }: FacebookSignupProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFacebookSignup = async () => {
    setIsLoading(true);
    try {
      // Redirect to Facebook OAuth
      window.location.href = '/api/auth/facebook';
    } catch (error) {
      console.error('Facebook signup failed:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <TradeScoutLogo size="2xl" variant="gradient" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Join TradeScout</h1>
          <p className="text-xl text-slate-300 mb-2">
            Connect with trusted contractors and homeowners in your community
          </p>
          <p className="text-slate-400">
            The faster, easier way to get started
          </p>
        </div>

        {/* Main Signup Card */}
        <Card className="bg-slate-800/50 border-slate-700 max-w-md mx-auto mb-8">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-white">Get Started</CardTitle>
            <p className="text-slate-400">Join thousands of homeowners and contractors</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Facebook Signup Button */}
            <Button
              onClick={handleFacebookSignup}
              disabled={isLoading}
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 flex items-center justify-center gap-3 transition-all duration-300 hover:scale-105"
              data-testid="button-facebook-signup"
            >
              <Facebook className="w-5 h-5" />
              {isLoading ? 'Connecting...' : 'Sign up with Facebook'}
            </Button>
            
            <div className="text-center">
              <Badge variant="secondary" className="bg-green-900/50 text-green-400 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                3x Higher Success Rate
              </Badge>
            </div>

            <div className="text-center text-sm text-slate-400">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-4 h-4" />
                <span>Secure OAuth Authentication</span>
              </div>
              <p>We never post to your Facebook or access your private data</p>
            </div>

            {/* Alternative Options */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-400">or</span>
              </div>
            </div>

            {onSkipToRegular && (
              <Button
                onClick={onSkipToRegular}
                variant="outline"
                size="lg"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                data-testid="button-regular-signup"
              >
                Sign up with Email
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Facebook className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Instant Setup</h3>
              <p className="text-slate-400 text-sm">
                Pre-fill your profile with Facebook info and start immediately
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Trusted Network</h3>
              <p className="text-slate-400 text-sm">
                Connect with verified contractors and real homeowners
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Local Community</h3>
              <p className="text-slate-400 text-sm">
                Find contractors and customers in your specific area
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Success Stats */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 mb-6">Why contractors choose Facebook signup:</p>
          <div className="flex justify-center gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">3x</div>
              <div className="text-sm text-slate-400">Higher Conversion</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">60-80%</div>
              <div className="text-sm text-slate-400">Completion Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-400">2 min</div>
              <div className="text-sm text-slate-400">Average Setup</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-500 text-sm">
            By signing up, you agree to our{' '}
            <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}