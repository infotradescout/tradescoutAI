import { memo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { MessageSquare, Calendar, MapPin, CheckCircle2 } from "lucide-react";
import { useHandedness } from "@/hooks/useHandedness";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocationContext } from "@/hooks/useLocationContext";
import { OutcomeConfirmationCard } from "@/components/OutcomeConfirmationCard";
import { useLocation } from "wouter";
import { Page, Section } from "@/components/layout/PagePrimitives";

const RequestQuote = memo(function RequestQuote() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [lastLeadId, setLastLeadId] = useState<string | null>(null);
  const leadInitiatedAtRef = useRef<number | null>(null);
  const handedness = useHandedness();
  const [sendToCount, setSendToCount] = useState<string>("3"); // '1', '3', or 'manual'
  const [selectedContractorIds, setSelectedContractorIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    projectType: "",
    description: "",
    budget: "",
    timeline: "",
    location: user?.address || "",
    contactMethod: "email",
  });

  const isManualSelection = sendToCount === "manual";

  const locationCtx = useLocationContext();
  const stateCode = locationCtx.stateCode as string | undefined;
  const countyFips = locationCtx.countyFips as string | undefined;

  const { data: localContractors = [], isLoading: localContractorsLoading } = useQuery({
    queryKey: ["local-contractors", user?.county, formData.projectType],
    enabled: !!user?.county && !!formData.projectType && isManualSelection,
    queryFn: async () => {
      if (!user?.county || !formData.projectType) return [] as any[];
      const params = new URLSearchParams({
        county: String(user.county),
        trade: String(formData.projectType),
        limit: "50",
        sort: "verified",
      });
      const res = await apiRequest("GET", `/api/contractors/search?${params.toString()}`);
      return (res as any[]) || [];
    },
  });

  const submitQuoteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Map the friendly form fields into the lead schema used by /api/leads
      const payload = {
        projectType: data.projectType || "general",
        description: data.description,
        routingType: isManualSelection ? "manual" : "top3",
        maxAssignees: isManualSelection
          ? selectedContractorIds.length || 1
          : Number(sendToCount) || 3,
        manualContractorIds: isManualSelection ? selectedContractorIds : undefined,
        // Use best-effort locality from the user's stored profile/address
        countyId: (user as any)?.countyId || (user as any)?.county || "unknown",
        tradeId: data.projectType || "general",
        estimatedValue: null,
        urgency: data.timeline || "planning",
        contactPreference: data.contactMethod || "email",
        // Allow backend to attach UTM / calculator / locality data later
        calculatorData: {
          budgetRange: data.budget || null,
          timeline: data.timeline || null,
          rawLocation: data.location || null,
        },
      };

      return apiRequest("POST", "/api/leads", payload);
    },
    onSuccess: (created: any) => {
      setLastLeadId(created?.id ?? null);
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
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isManualSelection) {
      if (!user?.county) {
        toast({
          title: "Add your location first",
          description:
            "Set your location in profile settings so we can show local pros, or choose a best-matched option instead.",
          variant: "destructive",
        });
        return;
      }
      if (!selectedContractorIds.length) {
        toast({
          title: "Pick at least one pro",
          description:
            "Select one or more local contractors, or switch back to a best-matched option.",
          variant: "destructive",
        });
        return;
      }
    }

    leadInitiatedAtRef.current = Date.now();
    submitQuoteMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <Page className="max-w-3xl">
        <Card className="bg-card border-border shadow-xl">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 bg-primary/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">Quote Request Submitted!</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Your request was sent. You will get responses here.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => setSubmitted(false)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Submit Another Request
              </Button>
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:bg-muted"
                onClick={() => navigate("/")}
              >
                Back to Dashboard
              </Button>
            </div>

            <OutcomeConfirmationCard
              actionType="provider_coordination"
              artifactId={lastLeadId ?? undefined}
              stateCode={stateCode}
              countyFips={countyFips}
              initiatedBy="direct"
              initiatedAtMs={leadInitiatedAtRef.current ?? undefined}
            />
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <Page className="max-w-3xl pb-20 lg:pb-0">
      <Section
        title={
          <span className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            Request a Quote
          </span>
        }
        subtitle="Share the project. We handle routing."
      >
        {/* Form */}
        <Card className="bg-card border-border shadow-xl">
          <CardHeader className="border-b border-border pb-6">
            <CardTitle className="text-xl text-foreground">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="projectType" className="text-foreground font-medium">
                    Project Type
                  </Label>
                  <Select
                    value={formData.projectType}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, projectType: value }))
                    }
                  >
                    <SelectTrigger className="bg-background border-input text-foreground h-11">
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
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
                  <Label htmlFor="description" className="text-foreground font-medium">
                    Project Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="bg-background border-input text-foreground min-h-[120px] focus:border-primary transition-colors resize-none"
                    placeholder="Describe your project in detail..."
                    required
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-foreground font-medium">
                    Budget Range
                  </Label>
                  <Select
                    value={formData.budget}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, budget: value }))}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground h-11">
                      <SelectValue placeholder="Select budget range" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
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
                  <Label
                    htmlFor="timeline"
                    className="text-foreground font-medium flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4 text-primary" />
                    Timeline
                  </Label>
                  <Select
                    value={formData.timeline}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, timeline: value }))}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground h-11">
                      <SelectValue placeholder="When do you need this done?" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="asap">As soon as possible</SelectItem>
                      <SelectItem value="1-2-weeks">Within 1-2 weeks</SelectItem>
                      <SelectItem value="1-month">Within 1 month</SelectItem>
                      <SelectItem value="1-3-months">1-3 months</SelectItem>
                      <SelectItem value="3-6-months">3-6 months</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="location"
                    className="text-foreground font-medium flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                    Project Location
                  </Label>
                  <Input
                    id="location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                    className="bg-background border-input text-foreground h-11 focus:border-primary transition-colors"
                    placeholder="Enter project address"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactMethod" className="text-foreground font-medium">
                    Preferred Contact Method
                  </Label>
                  <Select
                    value={formData.contactMethod}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, contactMethod: value }))
                    }
                  >
                    <SelectTrigger className="bg-background border-input text-foreground h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="text">Text Message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground font-medium">
                    How many pros should receive this?
                  </Label>
                  <Select
                    value={sendToCount}
                    onValueChange={(value) => {
                      setSendToCount(value);
                      if (value !== "manual") {
                        setSelectedContractorIds([]);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="1">Top 1 best-matched</SelectItem>
                      <SelectItem value="3">Top 3 best-matched</SelectItem>
                      <SelectItem value="manual">Let me pick specific local pros</SelectItem>
                    </SelectContent>
                  </Select>
                  {isManualSelection ? (
                    <div className="mt-3 space-y-2 border border-border rounded-lg p-3 bg-background">
                      <p className="text-xs text-muted-foreground mb-1">
                        Pick the exact local pros to notify.
                      </p>
                      {!user?.county && (
                        <p className="text-xs text-destructive">
                          Add your location in your profile settings so we can list local
                          contractors, or switch back to a best-match option.
                        </p>
                      )}
                      {user?.county && (
                        <div className="max-h-56 overflow-y-auto space-y-2">
                          {localContractorsLoading && (
                            <p className="text-xs text-muted-foreground">Loading local pros...</p>
                          )}
                          {!localContractorsLoading &&
                            (!localContractors || (localContractors as any[]).length === 0) && (
                              <p className="text-xs text-muted-foreground">
                                No active contractors found for your area and trade yet. Try a
                                different project type or use the best-matched routing.
                              </p>
                            )}
                          {(localContractors as any[]).map((contractor: any) => {
                            const checked = selectedContractorIds.includes(contractor.id);
                            const label =
                              contractor.companyName || contractor.name || "Local contractor";
                            const locationBits = [contractor.city, contractor.state]
                              .filter(Boolean)
                              .join(", ");
                            return (
                              <label
                                key={contractor.id}
                                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    const isChecked = value === true;
                                    setSelectedContractorIds((prev) => {
                                      if (isChecked) {
                                        if (prev.includes(contractor.id)) return prev;
                                        return [...prev, contractor.id];
                                      }
                                      return prev.filter((id) => id !== contractor.id);
                                    });
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">
                                    {label}
                                  </p>
                                  {locationBits && (
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {locationBits}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      We auto-route to the best 1 or 3 local matches.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border">
                <Button
                  type="submit"
                  disabled={submitQuoteMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 shadow-lg"
                  data-testid="button-submitQuote"
                >
                  {submitQuoteMutation.isPending ? "Submitting..." : "Submit Quote Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted"
                  onClick={() => window.history.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Section>
    </Page>
  );
});

export default RequestQuote;
