import { memo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Award, CheckCircle, AlertTriangle, FileCheck, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type VerificationStatusResponse = {
  requirements?: { license?: boolean };
  submissions?: { licenseNumber?: string };
  status?: { license?: boolean };
};

const LicenseVerification = memo(function LicenseVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTrade, setSelectedTrade] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const { data } = useQuery<VerificationStatusResponse>({
    queryKey: ["/api/profile/verification"],
    queryFn: () => apiRequest("GET", "/api/profile/verification"),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      apiRequest("PATCH", "/api/profile/verification", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/verification"] });
      toast({ title: "License submitted for review" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit",
        description: formatUserFacingErrorMessage(error, "Failed to submit."),
        variant: "destructive",
      });
    },
  });

  const alreadyVerified = Boolean(data?.status?.license);
  const alreadySubmitted = Boolean(data?.submissions?.licenseNumber);

  const handleLicenseDocFile = async (file: File) => {
    setIsUploadingDoc(true);
    try {
      const { objectKey } = await uploadPrivateObject(file);
      await submitMutation.mutateAsync({
        ...(licenseNumber.trim() ? { licenseNumber: licenseNumber.trim() } : {}),
        licenseDocObjectKey: objectKey,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(error, "Upload failed."),
        variant: "destructive",
      });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const tradeCategories = [
    { value: "general", label: "General Contractor", code: "GC" },
    { value: "electrical", label: "Electrical Contractor", code: "EC" },
    { value: "plumbing", label: "Plumbing Contractor", code: "PC" },
    { value: "hvac", label: "HVAC Contractor", code: "HC" },
    { value: "roofing", label: "Roofing Contractor", code: "RC" },
    { value: "flooring", label: "Flooring Contractor", code: "FC" },
    { value: "painting", label: "Painting Contractor", code: "PT" },
    { value: "landscaping", label: "Landscaping Contractor", code: "LC" },
  ];

  const states = [
    "California",
    "Texas",
    "Florida",
    "New York",
    "Pennsylvania",
    "Illinois",
    "Ohio",
    "Georgia",
    "North Carolina",
    "Michigan",
    "New Jersey",
    "Virginia",
    "Washington",
    "Arizona",
    "Massachusetts",
  ];

  const licenseRequirements = {
    general: {
      description:
        "General contractors oversee construction projects and coordinate subcontractors",
      requirements: [
        "State contractor license",
        "Business license",
        "Bond requirement varies by state",
        "Continuing education units",
      ],
      minimumExperience: "4 years",
    },
    electrical: {
      description: "Licensed electricians install and maintain electrical systems",
      requirements: [
        "Journeyman electrician license",
        "Master electrician certification",
        "Electrical contractor license",
        "Code compliance certification",
      ],
      minimumExperience: "8,000 hours",
    },
    plumbing: {
      description: "Licensed plumbers install and repair plumbing systems",
      requirements: [
        "Journeyman plumber license",
        "Master plumber certification",
        "Plumbing contractor license",
        "Backflow prevention certification",
      ],
      minimumExperience: "8,000 hours",
    },
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">License Verification</h1>
          <p className="text-xl text-muted-foreground">
            Verify your professional licenses to unlock contractor features and build customer trust
          </p>
        </div>

        {/* License Information Form */}
        <Card className="border-white/10 mb-8" style={{ backgroundColor: "var(--surface-card)" }}>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-ts-orange" />
              Professional License Information
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your license details for verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trade-select" className="text-foreground">
                    Trade Category
                  </Label>
                  <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                    <SelectTrigger className="bg-background border-input text-foreground">
                      <SelectValue placeholder="Select your trade" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {tradeCategories.map((trade) => (
                        <SelectItem key={trade.value} value={trade.value}>
                          {trade.label} ({trade.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="state-select" className="text-foreground">
                    Licensing State
                  </Label>
                  <Select>
                    <SelectTrigger className="bg-background border-input text-foreground">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {states.map((state) => (
                        <SelectItem key={state} value={state.toLowerCase()}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="license-number" className="text-foreground">
                    License Number
                  </Label>
                  <Input
                    id="license-number"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Enter license number"
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="issue-date" className="text-foreground">
                    Issue Date
                  </Label>
                  <Input
                    id="issue-date"
                    type="date"
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="expiry-date" className="text-foreground">
                    Expiration Date
                  </Label>
                  <Input
                    id="expiry-date"
                    type="date"
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div>
                  <Label htmlFor="issuing-authority" className="text-foreground">
                    Issuing Authority
                  </Label>
                  <Input
                    id="issuing-authority"
                    placeholder="e.g., California State Board"
                    className="bg-background border-input text-foreground"
                  />
                </div>
              </div>

              {licenseNumber && (
                <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCheck className="w-5 h-5 text-blue-400" />
                    <span className="font-medium text-blue-400">License Lookup Available</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    We can automatically verify your license through state databases.
                  </p>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Verify License Online
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* License Requirements */}
        {selectedTrade &&
          licenseRequirements[selectedTrade as keyof typeof licenseRequirements] && (
            <Card className="bg-card border-border mb-8">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {tradeCategories.find((t) => t.value === selectedTrade)?.label} Requirements
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Licensing requirements for your selected trade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    {
                      licenseRequirements[selectedTrade as keyof typeof licenseRequirements]
                        .description
                    }
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">
                        Required Licenses & Certifications
                      </h4>
                      <ul className="space-y-2">
                        {licenseRequirements[
                          selectedTrade as keyof typeof licenseRequirements
                        ].requirements.map((req, index) => (
                          <li key={index} className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-foreground mb-3">
                        Experience Requirements
                      </h4>
                      <div className="p-4 bg-ts-orange-dark/10 border border-ts-orange/30 rounded-lg">
                        <p className="text-ts-orange font-medium">
                          Minimum Experience:{" "}
                          {
                            licenseRequirements[selectedTrade as keyof typeof licenseRequirements]
                              .minimumExperience
                          }
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Most states require documented work experience under a licensed
                          contractor.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        {/* Document Upload */}
        <Card className="border-white/10 mb-8" style={{ backgroundColor: "var(--surface-card)" }}>
          <CardHeader>
            <CardTitle className="text-foreground">License Document Upload</CardTitle>
            <CardDescription className="text-muted-foreground">
              Upload clear photos or scans of your license certificates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Upload License Documents
                </h3>
                <p className="text-muted-foreground mb-4">
                  Drop your license files here or click to browse
                </p>
                <p className="text-sm text-muted-foreground/70 mb-4">
                  Supported formats: PDF, JPG, PNG (Max 10MB each)
                </p>
                {alreadyVerified ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">License verified</span>
                  </div>
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-ts-orange-dark px-4 py-2 text-sm text-white hover:opacity-90">
                    {isUploadingDoc ? "Uploading..." : "Select Files"}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      disabled={isUploadingDoc}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleLicenseDocFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                {!alreadyVerified && alreadySubmitted && (
                  <p className="mt-3 text-xs text-amber-400">Submitted, pending review.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Primary License</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload your main contractor or trade license
                  </p>
                  <Badge variant="outline" className="border-red-500 text-red-400">
                    Required
                  </Badge>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Additional Certifications</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload any specialty or trade-specific certifications
                  </p>
                  <Badge variant="outline" className="border-blue-500 text-blue-400">
                    Optional
                  </Badge>
                </div>
              </div>

              <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-400 mb-2">Upload Guidelines</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Ensure all text and numbers are clearly visible</li>
                      <li>• Include both front and back of license if applicable</li>
                      <li>• License must be current and not expired</li>
                      <li>• Name on license must match your account information</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {alreadyVerified ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Your license is verified.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              className="flex-1 bg-ts-orange-dark hover:bg-ts-orange-dark"
              disabled={!licenseNumber.trim() || submitMutation.isPending}
              onClick={() => submitMutation.mutate({ licenseNumber: licenseNumber.trim() })}
            >
              Submit License Number for Verification
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

export default LicenseVerification;
