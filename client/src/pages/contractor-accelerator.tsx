import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Target, BarChart3, Users, Star, ArrowRight, Phone, Mail, MessageCircle, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ContractorAccelerator() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [showVerificationRequired, setShowVerificationRequired] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.role === 'contractor_user' && user.verificationStatus !== 'verified') {
      setShowVerificationRequired(true);
    }
  }, [isAuthenticated, user, isLoading]);

  const enrollMutation = useMutation({
    mutationFn: async (planType: string) => {
      const response = await apiRequest('POST', '/api/accelerator/enroll', { planType });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome to Accelerator!",
        description: "Your enrollment is being processed. You'll receive access details shortly.",
      });
    },
    onError: () => {
      toast({
        title: "Enrollment Failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    }
  });

  const handleEnroll = (planType: string) => {
    enrollMutation.mutate(planType);
  };

  // Show verification required message for unverified contractors
  if (!isLoading && isAuthenticated && user && user.role === 'contractor_user' && user.verificationStatus !== 'verified') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-amber-900/20 border-amber-500/50">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Verification Required</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              To join the Accelerator program, you need to be a verified contractor. Complete your verification process first.
            </p>
            
            <div className="space-y-4">
              <Button 
                onClick={() => window.location.href = '/contractors/apply'}
                className="bg-purple-500 hover:bg-purple-600 text-white px-8 py-3"
              >
                Complete Verification
              </Button>
              <p className="text-sm text-gray-400">
                Already submitted? We'll review your application within 2-3 business days.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show authentication required for guests
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-800 border-navy-700">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Crown className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Contractor Account Required</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              The Accelerator program is exclusively for verified contractors. Create your contractor account to get started.
            </p>
            
            <div className="space-y-4">
              <Button 
                onClick={() => window.location.href = '/register'}
                className="bg-purple-500 hover:bg-purple-600 text-white px-8 py-3"
              >
                Create Contractor Account
              </Button>
              <Button 
                onClick={() => window.location.href = '/login'}
                variant="outline"
                className="border-navy-600 text-gray-200 hover:bg-navy-700 px-8 py-3"
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="flex justify-center mb-6">
          <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 text-lg">
            <Crown className="h-5 w-5 mr-2" />
            Accelerator Program
          </Badge>
        </div>
        <h1 className="text-5xl font-bold text-white mb-6">
          Supercharge Your <span className="text-purple-500">Growth</span>
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
          Join TradeScout's elite contractor program for premium leads, advanced tools, 
          and priority placement. Transform your business with our most powerful platform.
        </p>
        
        <div className="flex justify-center gap-8 mb-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-500">3x</div>
            <div className="text-gray-300">More Quality Leads</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-500">85%</div>
            <div className="text-gray-300">Higher Close Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-500">24/7</div>
            <div className="text-gray-300">Priority Support</div>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">Choose Your Plan</h2>
          <div className="flex justify-center">
            <div className="bg-navy-700 p-1 rounded-lg flex">
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`px-6 py-2 rounded-md transition-all ${
                  selectedPlan === 'monthly' 
                    ? 'bg-purple-500 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedPlan('annual')}
                className={`px-6 py-2 rounded-md transition-all ${
                  selectedPlan === 'annual' 
                    ? 'bg-purple-500 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Annual
                <Badge className="ml-2 bg-green-500 text-white text-xs">Save 20%</Badge>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <Card className={`border-2 transition-all ${
            selectedPlan === 'monthly' 
              ? 'border-purple-500 bg-purple-500/5' 
              : 'border-navy-600 bg-navy-700'
          }`}>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-white text-2xl">Monthly Access</CardTitle>
              <div className="text-4xl font-bold text-purple-500 mt-2">
                $297<span className="text-lg text-gray-400">/month</span>
              </div>
              <p className="text-gray-300">Perfect for testing the waters</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">Priority lead placement</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">Advanced analytics dashboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">Custom lead filters</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">24/7 priority support</span>
                </div>
              </div>
              <Button 
                onClick={() => handleEnroll('monthly')}
                disabled={enrollMutation.isPending}
                className={`w-full py-3 font-semibold transition-all ${
                  selectedPlan === 'monthly'
                    ? 'bg-purple-500 hover:bg-purple-600 glow-effect'
                    : 'bg-navy-600 hover:bg-navy-500'
                }`}
              >
                {enrollMutation.isPending ? 'Processing...' : 'Start Monthly Plan'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Annual Plan */}
          <Card className={`border-2 transition-all relative ${
            selectedPlan === 'annual' 
              ? 'border-purple-500 bg-purple-500/5' 
              : 'border-navy-600 bg-navy-700'
          }`}>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-green-500 text-white px-3 py-1">Most Popular</Badge>
            </div>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-white text-2xl">Annual Access</CardTitle>
              <div className="text-4xl font-bold text-purple-500 mt-2">
                $2,376<span className="text-lg text-gray-400">/year</span>
              </div>
              <div className="text-green-500 font-semibold">Save $594 annually</div>
              <p className="text-gray-300">Best value for committed growth</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">Everything in Monthly</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">Exclusive territory protection</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">Personal account manager</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-gray-300">Free business consultation</span>
                </div>
              </div>
              <Button 
                onClick={() => handleEnroll('annual')}
                disabled={enrollMutation.isPending}
                className={`w-full py-3 font-semibold transition-all ${
                  selectedPlan === 'annual'
                    ? 'bg-purple-500 hover:bg-purple-600 glow-effect'
                    : 'bg-navy-600 hover:bg-navy-500'
                }`}
              >
                {enrollMutation.isPending ? 'Processing...' : 'Start Annual Plan'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Features Grid */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Accelerator Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Priority Lead Access</h3>
              <p className="text-gray-300">
                Get first access to the highest-quality leads in your service area before standard members.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Advanced Analytics</h3>
              <p className="text-gray-300">
                Deep insights into lead performance, conversion rates, and ROI optimization tools.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Custom Lead Filters</h3>
              <p className="text-gray-300">
                Set precise criteria for lead quality, project size, and customer preferences.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Territory Protection</h3>
              <p className="text-gray-300">
                Exclusive service areas to reduce competition and maximize your market share.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Account Management</h3>
              <p className="text-gray-300">
                Dedicated account manager to optimize your strategy and maximize results.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Premium Placement</h3>
              <p className="text-gray-300">
                Featured contractor status in search results and homeowner recommendations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Stories */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Success Stories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  JC
                </div>
                <div>
                  <h4 className="text-white font-semibold">Johnson Contracting</h4>
                  <p className="text-gray-400 text-sm">General Contractor</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">
                "Accelerator increased our monthly revenue by 180% in just 6 months. The quality of leads is exceptional."
              </p>
              <div className="text-purple-500 font-semibold">+180% Revenue Growth</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  PR
                </div>
                <div>
                  <h4 className="text-white font-semibold">Premium Roofing</h4>
                  <p className="text-gray-400 text-sm">Roofing Specialist</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">
                "The territory protection feature eliminated competition and allowed us to dominate our market."
              </p>
              <div className="text-purple-500 font-semibold">95% Lead Close Rate</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  EE
                </div>
                <div>
                  <h4 className="text-white font-semibold">Elite Electric</h4>
                  <p className="text-gray-400 text-sm">Electrical Contractor</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">
                "The analytics helped us optimize our bidding strategy. We're winning more jobs at better margins."
              </p>
              <div className="text-purple-500 font-semibold">+40% Profit Margins</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center">
        <Card className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border-purple-500/30">
          <CardContent className="p-12">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Accelerate Your Growth?</h2>
            <p className="text-xl text-gray-300 mb-8">
              Join hundreds of contractors who've transformed their business with Accelerator.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button className="bg-purple-500 hover:bg-purple-600 text-white px-8 py-3 text-lg glow-effect">
                <Phone className="h-5 w-5 mr-2" />
                Schedule a Call
              </Button>
              <Button variant="outline" className="border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white px-8 py-3 text-lg">
                <Mail className="h-5 w-5 mr-2" />
                Get More Info
              </Button>
            </div>
            
            <p className="text-gray-400 text-sm">
              Questions? Contact our Accelerator team at 
              <a href="mailto:accelerator@tradescout.com" className="text-purple-500 hover:underline ml-1">
                accelerator@tradescout.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}