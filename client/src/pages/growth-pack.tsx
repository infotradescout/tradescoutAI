import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Download, Check, ArrowRight, Gift, Users, TrendingUp, Target } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { GuestGate } from "@/components/guest-gate";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function GrowthPack() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    primaryTrade: '',
    serviceAreas: '',
    companySize: '',
    hasConsented: false,
  });
  const [isDownloaded, setIsDownloaded] = useState(false);

  const downloadMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/growth-pack', data);
      return response.json();
    },
    onSuccess: (data) => {
      setIsDownloaded(true);
      toast({
        title: "Success!",
        description: "Your Growth Pack is ready for download. Check your email for the link.",
      });
      
      // Simulate download
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = 'Trade-Scout-Growth-Pack.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.companyName || !formData.primaryTrade) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.hasConsented) {
      toast({
        title: "Consent Required",
        description: "Please agree to receive emails to download the Growth Pack.",
        variant: "destructive",
      });
      return;
    }

    downloadMutation.mutate(formData);
  };

  if (isDownloaded) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-green-900/20 border-green-500/50">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Growth Pack Downloaded!</h2>
            <p className="text-gray-300 mb-8">
              Your FREE contractor Growth Pack is ready. We've also sent a download link to your email.
            </p>
            
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Next Steps for Growth</h3>
                <p className="text-gray-300">Ready to take your business to the next level?</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/contractors/apply">
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 h-16">
                    <div className="text-center">
                      <div className="font-semibold">Join Contractor Board</div>
                      <div className="text-sm opacity-90">Get verified leads</div>
                    </div>
                  </Button>
                </Link>
                <Link href="/contractors/accelerator">
                  <Button variant="outline" className="w-full border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white h-16">
                    <div className="text-center">
                      <div className="font-semibold">Accelerator Program</div>
                      <div className="text-sm opacity-90">Premium growth tools</div>
                    </div>
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <Badge className="bg-orange-500 text-white mb-4 px-4 py-1">
          <Gift className="h-4 w-4 mr-1" />
          100% FREE
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Contractor Growth Pack
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Get the tools and strategies that successful contractors use to grow their business
        </p>
      </div>

      {/* Main Content */}
      <Card className="bg-navy-700 border-navy-600 mb-8">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: What's Included */}
            <div>
              <h3 className="text-2xl font-semibold text-white mb-6">What's Included:</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Lead Generation Templates
                    </h4>
                    <p className="text-gray-300 text-sm">Proven email and social media templates that convert prospects into customers</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Pricing Strategy Guide
                    </h4>
                    <p className="text-gray-300 text-sm">How to price your services competitively while maximizing profit margins</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Customer Retention Playbook
                    </h4>
                    <p className="text-gray-300 text-sm">Turn one-time customers into repeat clients and referral sources</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Digital Marketing Checklist</h4>
                    <p className="text-gray-300 text-sm">Step-by-step guide to building your online presence and attracting customers</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Sign Up Form */}
            <div>
              <GuestGate
                action="download the free Growth Pack"
                title="Create Account to Download Growth Pack"
                description="Create a contractor account to access our comprehensive business growth resources."
              >
                <Card className="bg-navy-600 border-navy-500">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Get Your FREE Growth Pack
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Input
                        type="email"
                        placeholder="Your email address *"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                        className="form-field"
                      />
                    </div>
                    
                    <div>
                      <Input
                        type="text"
                        placeholder="Company name *"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        required
                        className="form-field"
                      />
                    </div>
                    
                    <div>
                      <Select 
                        value={formData.primaryTrade}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, primaryTrade: value }))}
                      >
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Select your primary trade *" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="roofing">Roofing</SelectItem>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="hvac">HVAC</SelectItem>
                          <SelectItem value="general">General Contractor</SelectItem>
                          <SelectItem value="landscaping">Landscaping</SelectItem>
                          <SelectItem value="flooring">Flooring</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Input
                        type="text"
                        placeholder="Service areas (counties/states)"
                        value={formData.serviceAreas}
                        onChange={(e) => setFormData(prev => ({ ...prev, serviceAreas: e.target.value }))}
                        className="form-field"
                      />
                    </div>

                    <div>
                      <Select 
                        value={formData.companySize}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, companySize: value }))}
                      >
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Company size (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solo">Just me</SelectItem>
                          <SelectItem value="small">2-5 employees</SelectItem>
                          <SelectItem value="medium">6-20 employees</SelectItem>
                          <SelectItem value="large">20+ employees</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="consent"
                        checked={formData.hasConsented}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasConsented: !!checked }))}
                        className="mt-1"
                      />
                      <label htmlFor="consent" className="text-xs text-gray-400 cursor-pointer">
                        I agree to receive occasional emails with contractor tips and business growth opportunities. 
                        You can unsubscribe at any time.
                      </label>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={downloadMutation.isPending}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold glow-effect transition-all duration-300"
                    >
                      {downloadMutation.isPending ? (
                        'Processing...'
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download Growth Pack
                        </>
                      )}
                    </Button>
                    </form>
                  </CardContent>
                </Card>
              </GuestGate>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps CTA */}
      <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Ready to start getting leads?</h3>
          <p className="text-gray-300 mb-6">
            Join our contractor board to get connected with homeowners looking for your services
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contractors/apply">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold glow-effect transition-all duration-300">
                Join Contractor Board
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/contractors/accelerator">
              <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300">
                View Accelerator Program
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Social Proof */}
      <div className="mt-12 text-center">
        <p className="text-gray-400 mb-6">Trusted by 2,000+ contractors nationwide</p>
        <div className="flex justify-center space-x-8 text-gray-500">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">85%</div>
            <div className="text-sm">Report increased leads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">92%</div>
            <div className="text-sm">Improved pricing confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">78%</div>
            <div className="text-sm">Better customer retention</div>
          </div>
        </div>
      </div>
    </div>
  );
}
