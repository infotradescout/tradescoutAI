import { memo, useState } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, DollarSign, Calendar, MapPin, CheckCircle2 } from "lucide-react";

const RequestQuote = memo(function RequestQuote() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    projectType: '',
    description: '',
    budget: '',
    timeline: '',
    location: user?.address || '',
    contactMethod: 'email'
  });

  const submitQuoteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/quotes/request', data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Quote Request Submitted!",
        description: "Contractors in your area will review your request and respond soon.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit quote request. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuoteMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0f1419] pb-20 lg:pb-0">
        <div className="container mx-auto px-4 py-6 lg:py-10">
          <div className="max-w-3xl mx-auto">
            <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="flex justify-center mb-6">
                  <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Quote Request Submitted!</h2>
                <p className="text-slate-300 text-lg mb-8">
                  Your request has been sent to qualified contractors in your area. 
                  You'll receive responses within 24-48 hours.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button 
                    onClick={() => setSubmitted(false)}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Submit Another Request
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]"
                    onClick={() => window.location.href = '/'}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] pb-20 lg:pb-0">
      <div className="container mx-auto px-4 py-6 lg:py-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8 lg:mb-12">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-5xl font-bold text-white mb-1">Request a Quote</h1>
                <p className="text-lg text-slate-400">
                  Tell us about your project and get matched with qualified contractors
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
            <CardHeader className="border-b border-[#2d3748] pb-6">
              <CardTitle className="text-xl text-white">Project Details</CardTitle>
              <p className="text-sm text-slate-400 mt-1">
                Provide information about your project to receive accurate quotes
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="projectType" className="text-white font-medium">
                      Project Type
                    </Label>
                    <Select
                      value={formData.projectType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, projectType: value }))}
                    >
                      <SelectTrigger className="bg-[#0f1419] border-[#2d3748] text-white h-11">
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2332] border-[#2d3748]">
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="hvac">HVAC</SelectItem>
                        <SelectItem value="roofing">Roofing</SelectItem>
                        <SelectItem value="remodeling">Kitchen/Bath Remodeling</SelectItem>
                        <SelectItem value="painting">Painting</SelectItem>
                        <SelectItem value="flooring">Flooring</SelectItem>
                        <SelectItem value="landscaping">Landscaping</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-white font-medium">
                      Project Description
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-[#0f1419] border-[#2d3748] text-white min-h-[120px] focus:border-orange-500 transition-colors resize-none"
                      placeholder="Describe your project in detail..."
                      required
                      rows={5}
                    />
                    <p className="text-xs text-slate-400">
                      Include details about the scope, materials, and any specific requirements
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="budget" className="text-white font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-orange-500" />
                        Estimated Budget
                      </Label>
                      <Select
                        value={formData.budget}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, budget: value }))}
                      >
                        <SelectTrigger className="bg-[#0f1419] border-[#2d3748] text-white h-11">
                          <SelectValue placeholder="Select budget range" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2332] border-[#2d3748]">
                          <SelectItem value="under-1k">Under $1,000</SelectItem>
                          <SelectItem value="1k-5k">$1,000 - $5,000</SelectItem>
                          <SelectItem value="5k-10k">$5,000 - $10,000</SelectItem>
                          <SelectItem value="10k-25k">$10,000 - $25,000</SelectItem>
                          <SelectItem value="25k-50k">$25,000 - $50,000</SelectItem>
                          <SelectItem value="over-50k">Over $50,000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeline" className="text-white font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        Timeline
                      </Label>
                      <Select
                        value={formData.timeline}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, timeline: value }))}
                      >
                        <SelectTrigger className="bg-[#0f1419] border-[#2d3748] text-white h-11">
                          <SelectValue placeholder="When do you need this done?" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a2332] border-[#2d3748]">
                          <SelectItem value="asap">As soon as possible</SelectItem>
                          <SelectItem value="1-2-weeks">Within 1-2 weeks</SelectItem>
                          <SelectItem value="1-month">Within 1 month</SelectItem>
                          <SelectItem value="1-3-months">1-3 months</SelectItem>
                          <SelectItem value="3-6-months">3-6 months</SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-white font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-500" />
                      Project Location
                    </Label>
                    <Input
                      id="location"
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="Enter project address"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactMethod" className="text-white font-medium">
                      Preferred Contact Method
                    </Label>
                    <Select
                      value={formData.contactMethod}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, contactMethod: value }))}
                    >
                      <SelectTrigger className="bg-[#0f1419] border-[#2d3748] text-white h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2332] border-[#2d3748]">
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="text">Text Message</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[#2d3748]">
                  <Button
                    type="submit"
                    disabled={submitQuoteMutation.isPending}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 shadow-lg"
                    data-testid="button-submitQuote"
                  >
                    {submitQuoteMutation.isPending ? 'Submitting...' : 'Submit Quote Request'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]"
                    onClick={() => window.history.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Info Section */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="text-white font-semibold mb-1">Fast Responses</h3>
                <p className="text-sm text-slate-400">
                  Get quotes from contractors within 24-48 hours
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="text-white font-semibold mb-1">Verified Pros</h3>
                <p className="text-sm text-slate-400">
                  All contractors are vetted and verified
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#1a2332] border-[#2d3748]">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="text-white font-semibold mb-1">100% Free</h3>
                <p className="text-sm text-slate-400">
                  No cost to request quotes or compare contractors
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
});

export default RequestQuote;
