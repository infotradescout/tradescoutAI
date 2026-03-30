import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  FileText,
  Users,
  Star,
  ArrowRight,
  Shield,
  Phone,
  Mail,
  MapPin,
  Building,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { GuestGate } from "@/components/guest-gate";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function ContractorApply() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [route] = useLocation();
  const [fromScoutReview, setFromScoutReview] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    primaryTrade: "",
    secondaryTrades: "",
    licenseNumber: "",
    insuranceAmount: "",
    yearsInBusiness: "",
    employeeCount: "",
    serviceRadius: "",
    website: "",
    description: "",
    hasLicense: false,
    hasInsurance: false,
    hasConsented: false,
    isGeneralContractor: false,
    isResidentialContractor: false,
    acceptsSubcontractWork: false,
  });

  const applicationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/contractors/apply", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you within 2-3 business days.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.companyName || !formData.email || !formData.phone || !formData.primaryTrade) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.hasLicense || !formData.hasInsurance || !formData.hasConsented) {
      toast({
        title: "Requirements Not Met",
        description: "Please confirm license, insurance, and consent requirements.",
        variant: "destructive",
      });
      return;
    }

    applicationMutation.mutate(formData);
  };

  useEffect(() => {
    if (!route) return;
    const idx = route.indexOf("?");
    if (idx === -1) return;
    const search = route.slice(idx + 1);
    const params = new URLSearchParams(search);
    if (params.get("review") === "1") {
      setFromScoutReview(true);
    }
  }, [route]);

  // Show authentication required for guests
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <GuestGate
          action="apply to the contractor board"
          title="Create Contractor Account to Apply"
          description="Join TradeScout's verified contractor network and start receiving quality leads."
        >
          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-ts-orange rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Apply to Join TradeScout</h2>
              <p className="text-white/70 mb-8 max-w-2xl mx-auto">
                Join thousands of verified contractors growing their business with TradeScout.
              </p>
            </CardContent>
          </Card>
        </GuestGate>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEOHelmet
        title="Contractor Application | Join TradeScout's Verified Network"
        description="Apply to join TradeScout as a contractor. Submit your business details, licensing, and insurance information to get reviewed."
        canonical="https://www.thetradescout.com/contractors/apply"
      />
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">Join TradeScout's Contractor Network</h1>
        <p className="text-xl text-white/70 mb-6">
          Connect with qualified homeowners and grow your business
        </p>
        {fromScoutReview && (
          <div className="mx-auto max-w-2xl mt-3 rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 flex items-start gap-2 text-left">
            <Shield className="h-4 w-4 mt-[2px] text-amber-300" />
            <div>
              <p className="font-semibold">Scout drafted this setup</p>
              <p className="mt-0.5 text-[11px] text-amber-100/90">
                We brought you here from Scout so you can review and complete your provider details.
                Make any edits you need, then submit your application when everything looks right.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-8">
          <div className="flex items-center gap-2 text-white/70">
            <Users className="h-5 w-5 text-ts-orange" />
            <span className="text-sm md:text-base">10,000+ Active Homeowners</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <Star className="h-5 w-5 text-ts-orange" />
            <span className="text-sm md:text-base">Premium Lead Quality</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <Shield className="h-5 w-5 text-ts-orange" />
            <span className="text-sm md:text-base">Verified Professional Network</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Application Form */}
        <div className="lg:col-span-2">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contractor Application
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Company Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/70">Company Name *</Label>
                      <Input
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, companyName: e.target.value }))
                        }
                        className="form-field"
                        placeholder="Your Company LLC"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">Contact Name *</Label>
                      <Input
                        value={formData.contactName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactName: e.target.value }))
                        }
                        className="form-field"
                        placeholder="John Smith"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/70">Email *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="form-field"
                        placeholder="john@company.com"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">Phone *</Label>
                      <Input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className="form-field"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-white/70">Business Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      className="form-field"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-white/70">City</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                        className="form-field"
                        placeholder="Los Angeles"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">State</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, state: value }))
                        }
                      >
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="NY">New York</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-white/70">ZIP Code</Label>
                      <Input
                        value={formData.zipCode}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, zipCode: e.target.value }))
                        }
                        className="form-field"
                        placeholder="90210"
                      />
                    </div>
                  </div>
                </div>

                {/* Trade Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Trade Specialization</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/70">Primary Trade *</Label>
                      <Select
                        value={formData.primaryTrade}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, primaryTrade: value }))
                        }
                      >
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Select primary trade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="roofing">Roofing</SelectItem>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="hvac">HVAC</SelectItem>
                          <SelectItem value="flooring">Flooring</SelectItem>
                          <SelectItem value="general">General Contracting</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-white/70">Secondary Trades</Label>
                      <Input
                        value={formData.secondaryTrades}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, secondaryTrades: e.target.value }))
                        }
                        className="form-field"
                        placeholder="e.g., Electrical, Plumbing"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/70">License Number</Label>
                      <Input
                        value={formData.licenseNumber}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, licenseNumber: e.target.value }))
                        }
                        className="form-field"
                        placeholder="License #"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">Service Radius (miles)</Label>
                      <Input
                        type="number"
                        value={formData.serviceRadius}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, serviceRadius: e.target.value }))
                        }
                        className="form-field"
                        placeholder="25"
                      />
                    </div>
                  </div>
                </div>

                {/* Contractor Type */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Contractor Type</h3>
                  <p className="text-white/70 text-sm">
                    Select all that apply to describe your business
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="generalContractor"
                        checked={formData.isGeneralContractor}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, isGeneralContractor: !!checked }))
                        }
                      />
                      <Label htmlFor="generalContractor" className="text-white/70">
                        General Contractor - I manage complete construction projects and coordinate
                        with other trades
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="residentialContractor"
                        checked={formData.isResidentialContractor}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, isResidentialContractor: !!checked }))
                        }
                      />
                      <Label htmlFor="residentialContractor" className="text-white/70">
                        Residential Contractor - I specialize in home improvement and residential
                        projects
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="acceptsSubcontractWork"
                        checked={formData.acceptsSubcontractWork}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, acceptsSubcontractWork: !!checked }))
                        }
                      />
                      <Label htmlFor="acceptsSubcontractWork" className="text-white/70">
                        Accept Subcontract Work - I'm available to work as a subcontractor for other
                        contractors
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Business Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Business Details</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-white/70">Years in Business</Label>
                      <Input
                        type="number"
                        value={formData.yearsInBusiness}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, yearsInBusiness: e.target.value }))
                        }
                        className="form-field"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">Number of Employees</Label>
                      <Input
                        type="number"
                        value={formData.employeeCount}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, employeeCount: e.target.value }))
                        }
                        className="form-field"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">Insurance Amount</Label>
                      <Input
                        value={formData.insuranceAmount}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, insuranceAmount: e.target.value }))
                        }
                        className="form-field"
                        placeholder="$1,000,000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-white/70">Website (optional)</Label>
                    <Input
                      type="url"
                      value={formData.website}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, website: e.target.value }))
                      }
                      className="form-field"
                      placeholder="https://yourcompany.com"
                    />
                  </div>

                  <div>
                    <Label className="text-white/70">Company Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="form-field"
                      rows={4}
                      placeholder="Tell us about your company, experience, and what sets you apart..."
                    />
                  </div>
                </div>

                {/* Requirements */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Requirements</h3>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="license"
                        checked={formData.hasLicense}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, hasLicense: !!checked }))
                        }
                      />
                      <Label htmlFor="license" className="text-white/70">
                        I have a valid business license for my trade
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="insurance"
                        checked={formData.hasInsurance}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, hasInsurance: !!checked }))
                        }
                      />
                      <Label htmlFor="insurance" className="text-white/70">
                        I have general liability insurance (minimum $500,000)
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="consent"
                        checked={formData.hasConsented}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, hasConsented: !!checked }))
                        }
                      />
                      <Label htmlFor="consent" className="text-white/70">
                        I agree to TradeScout's terms and contractor guidelines
                      </Label>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={applicationMutation.isPending}
                  className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white py-3 rounded-lg font-semibold glow-effect transition-all duration-300"
                >
                  {applicationMutation.isPending
                    ? "Submitting Application..."
                    : "Submit Application"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Benefits Sidebar */}
        <div className="space-y-6">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-lg">Why Join TradeScout?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-ts-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Quality Leads</h4>
                  <p className="text-white/70 text-sm">Pre-qualified homeowners ready to hire</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-ts-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Local Focus</h4>
                  <p className="text-white/70 text-sm">
                    County-based connection routing in your service area
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-ts-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Professional Network</h4>
                  <p className="text-white/70 text-sm">Join verified, licensed contractors</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-ts-orange rounded-full flex items-center justify-center flex-shrink-0">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Build Your Reputation</h4>
                  <p className="text-white/70 text-sm">
                    Build recommendations and strengthen your CVS
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-ts-orange/30">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Application Process</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-ts-orange rounded-full flex items-center justify-center text-white text-xs">
                    1
                  </div>
                  <span className="text-white/70">Submit application</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-ts-orange rounded-full flex items-center justify-center text-white text-xs">
                    2
                  </div>
                  <span className="text-white/70">Document verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-ts-orange rounded-full flex items-center justify-center text-white text-xs">
                    3
                  </div>
                  <span className="text-white/70">Background check</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-ts-orange rounded-full flex items-center justify-center text-white text-xs">
                    4
                  </div>
                  <span className="text-white/70">Welcome to network</span>
                </div>
              </div>
              <p className="text-white/70 text-xs mt-4">Typical approval time: 2-3 business days</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
