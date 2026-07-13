import { memo, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { useParams } from "wouter";
import { Wrench, Phone, Mail, CheckCircle, XCircle } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { HOAManagementShell } from "@/shells/HOAManagementShell";
import { HOANextStepsCard } from "@/components/hoa/HOANextStepsCard";

const HOA_SIMPLE_VIEW_KEY = "ts:hoa:simple_view:v1";

/**
 * /hoa/maintenance - HOA Vendor Directory and Service Requests
 *
 * Psychology Intent:
 * - Target belief: "Maintenance is handled through a trusted, trackable path."
 * - Target behavior: submit requests through HOA channels, not side-channels.
 * - Principle(s): channeling, trust by process.
 * - Risk prevented: off-book requests and vendor chaos.
 */

type Vendor = {
  id: string;
  name: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  monthlyContract?: string;
  rating?: number;
  status: string;
  services: string[];
};

type HoaMembership = {
  hoaId: string;
  hoaName: string;
  role: string;
  status: string;
  stateCode: string | null;
  countyFips: string | null;
  groupType: "hoa";
};

const HOAMaintenance = memo(function HOAMaintenance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams();
  const hoaIdFromRoute = params?.hoaId as string | undefined;
  const location = useLocationContext({
    layer: "hoa",
    hoaId: hoaIdFromRoute ?? undefined,
  });
  const countyCommitted = hasCountyContext(location);

  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [simpleView, setSimpleView] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      setSimpleView(window.localStorage.getItem(HOA_SIMPLE_VIEW_KEY) === "1");
    } catch {
      // no-op
    }
  }, []);

  const toggleSimpleView = () => {
    setSimpleView((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(HOA_SIMPLE_VIEW_KEY, next ? "1" : "0");
        }
      } catch {
        // no-op
      }
      return next;
    });
  };

  // Load HOA memberships for the current user
  const { data: hoaMembershipData } = useQuery<{ memberships: HoaMembership[] }>({
    queryKey: ["/api/hoa", location.stateCode, location.countyFips, location.hoaId],
    queryFn: async () => {
      const res = await fetch("/api/hoa");
      if (!res.ok) throw new Error("Failed to load HOA memberships");
      return res.json();
    },
    enabled: !!user && countyCommitted,
  });

  const memberships = hoaMembershipData?.memberships ?? [];
  const activeHoaId = memberships[0]?.hoaId;

  // Fetch vendors
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/hoa", activeHoaId, "vendors"],
    queryFn: async () => {
      const response = await fetch(`/api/hoa/${activeHoaId}/vendors`);
      if (!response.ok) throw new Error("Failed to load vendors");
      return response.json();
    },
    enabled: !!activeHoaId && countyCommitted,
  });

  const requestServiceMutation = useMutation({
    mutationFn: async (data: {
      vendorId: string;
      serviceType: string;
      description: string;
      urgency: string;
    }) => {
      const response = await fetch(`/api/hoa/vendors/${data.vendorId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: data.serviceType,
          description: data.description,
          urgency: data.urgency,
          contactPreference: "email",
        }),
      });
      if (!response.ok) throw new Error("Failed to request service");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Service Requested",
        description: "Your maintenance request has been submitted to the vendor.",
      });
      setSelectedVendor(null);
      setServiceType("");
      setDescription("");
      setUrgency("normal");
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: formatUserFacingErrorMessage(error, "Failed to request service."),
        variant: "destructive",
      });
    },
  });

  const handleRequestService = () => {
    if (!selectedVendor || !serviceType || !description) {
      toast({
        title: "Missing Information",
        description: "Please select a vendor, service type, and provide a description.",
        variant: "destructive",
      });
      return;
    }
    requestServiceMutation.mutate({
      vendorId: selectedVendor,
      serviceType,
      description,
      urgency,
    });
  };

  if (!countyCommitted) {
    return (
      <HOAManagementShell locationOverride={location}>
        <SEOHelmet
          title="HOA Maintenance & Vendors | TradeScout"
          description="Manage HOA vendor relationships and maintenance requests."
          canonical="https://www.thetradescout.com/hoa/maintenance"
          noIndex
        />
        <Card className="bg-tsCard/60 border-white/10">
          <CardContent className="p-6">
            <p className="text-white/70">County context required to view HOA maintenance.</p>
          </CardContent>
        </Card>
      </HOAManagementShell>
    );
  }

  if (!activeHoaId) {
    return (
      <HOAManagementShell locationOverride={location}>
        <SEOHelmet
          title="HOA Maintenance & Vendors | TradeScout"
          description="Manage HOA vendor relationships and maintenance requests."
          canonical="https://www.thetradescout.com/hoa/maintenance"
          noIndex
        />
        <Card className="bg-tsCard/60 border-white/10">
          <CardContent className="p-6">
            <p className="text-white/70">You are not currently a member of an HOA.</p>
          </CardContent>
        </Card>
      </HOAManagementShell>
    );
  }

  const selectedVendorData = vendors.find((v) => v.id === selectedVendor);

  return (
    <HOAManagementShell locationOverride={location}>
      <SEOHelmet
        title="HOA Maintenance & Vendors | TradeScout"
        description="Manage HOA vendor relationships and maintenance requests."
        canonical="https://www.thetradescout.com/hoa/maintenance"
        noIndex
      />
      <div className={`space-y-6 ${simpleView ? "text-base" : ""}`}>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Wrench className="h-8 w-8 text-ts-orange" />
            HOA Maintenance & Vendors
          </h1>
          <p className="text-white/70 mt-2">{memberships[0]?.hoaName || "Your HOA"}</p>
        </div>

        <HOANextStepsCard
          title="What to do next"
          description="Submit one clear request at a time so your board and vendors can process it correctly."
          steps={[
            "Choose a vendor approved by your HOA.",
            "Select service type and urgency.",
            "Describe the issue clearly, then submit.",
          ]}
          simpleViewEnabled={simpleView}
          onToggleSimpleView={toggleSimpleView}
        />

        {/* Service Request Form */}
        <Card className="bg-tsCard/60 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Request Maintenance Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vendor" className="text-white/70">
                Select Vendor
              </Label>
              <Select value={selectedVendor || ""} onValueChange={setSelectedVendor}>
                <SelectTrigger className="bg-tsCard text-white border-white/10">
                  <SelectValue placeholder="Choose a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name} - {vendor.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVendorData && (
              <div>
                <Label htmlFor="serviceType" className="text-white/70">
                  Service Type
                </Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="bg-tsCard text-white border-white/10">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedVendorData.services.map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="urgency" className="text-white/70">
                Urgency
              </Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger className="bg-tsCard text-white border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description" className="text-white/70">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the maintenance issue or service needed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-tsCard text-white border-white/10"
                rows={4}
              />
            </div>

            <Button
              onClick={handleRequestService}
              disabled={!selectedVendor || !serviceType || !description}
              className="bg-ts-orange-dark hover:bg-ts-orange-dark"
            >
              Submit Request
            </Button>
          </CardContent>
        </Card>

        {/* Vendor Directory */}
        <div>
          <h2 className="text-2xl font-semibold text-white mb-4">Approved Vendors</h2>
          {isLoading ? (
            <Card className="bg-tsCard/60 border-white/10">
              <CardContent className="p-6">
                <p className="text-white/70">Loading vendors...</p>
              </CardContent>
            </Card>
          ) : vendors.length === 0 ? (
            <Card className="bg-tsCard/60 border-white/10">
              <CardContent className="p-6">
                <p className="text-white/70">No vendors configured yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {vendors.map((vendor) => (
                <Card key={vendor.id} className="bg-tsCard/60 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Wrench className="h-5 w-5 text-blue-400" />
                          <div>
                            <h3 className="text-lg font-semibold text-white">{vendor.name}</h3>
                            <Badge className="bg-purple-600 text-white mt-1">
                              {vendor.category}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-1 text-sm text-white/70 mt-3">
                          {vendor.contactPerson && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/60">Contact:</span>
                              <span>{vendor.contactPerson}</span>
                            </div>
                          )}
                          {vendor.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-white/60" />
                              <span>{vendor.phone}</span>
                            </div>
                          )}
                          {vendor.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-white/60" />
                              <span>{vendor.email}</span>
                            </div>
                          )}
                        </div>

                        {vendor.services.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {vendor.services.map((service) => (
                              <Badge
                                key={service}
                                variant="outline"
                                className="border-white/15 text-white/70"
                              >
                                {service}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="ml-4">
                        {vendor.status === "active" ? (
                          <CheckCircle className="h-6 w-6 text-emerald-400" />
                        ) : (
                          <XCircle className="h-6 w-6 text-white/60" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </HOAManagementShell>
  );
});

export default HOAMaintenance;
