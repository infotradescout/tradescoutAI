import { memo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Shield, CheckCircle, AlertTriangle, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type VerificationStatusResponse = {
  submissions?: { insuranceDocObjectKey?: string };
  status?: { insurance?: boolean };
};

const InsuranceVerification = memo(function InsuranceVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data } = useQuery<VerificationStatusResponse>({
    queryKey: ["/api/profile/verification"],
    queryFn: () => apiRequest("GET", "/api/profile/verification"),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      apiRequest("PATCH", "/api/profile/verification", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/verification"] });
      toast({ title: "Certificate submitted for review" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit certificate",
        description: formatUserFacingErrorMessage(error, "Could not submit this certificate."),
        variant: "destructive",
      });
    },
  });

  const alreadySubmitted = Boolean(data?.submissions?.insuranceDocObjectKey);
  const alreadyVerified = Boolean(data?.status?.insurance);

  const handleCertificateFile = async (file: File) => {
    setIsUploading(true);
    try {
      const { objectKey } = await uploadPrivateObject(file);
      await submitMutation.mutateAsync({ insuranceDocObjectKey: objectKey });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(error, "Could not upload this certificate."),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const insuranceRequirements = [
    {
      type: "General Liability",
      minimum: "$1,000,000",
      required: true,
      description: "Covers property damage and bodily injury claims",
    },
    {
      type: "Workers' Compensation",
      minimum: "State Required",
      required: true,
      description: "Required for businesses with employees",
    },
    {
      type: "Professional Liability",
      minimum: "$500,000",
      required: false,
      description: "Covers errors and omissions in professional services",
    },
    {
      type: "Commercial Auto",
      minimum: "$500,000",
      required: false,
      description: "Required if using vehicles for business",
    },
  ];

  const handleFileUpload = (insuranceType: string) => {
    // Simulate file upload
    setUploadedFiles([...uploadedFiles, insuranceType]);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Insurance Verification</h1>
          <p className="text-xl text-white/70">
            Upload your insurance certificates to complete professional verification
          </p>
        </div>

        {/* Requirements Overview */}
        <Card className="border-white/10 mb-8" style={{ backgroundColor: "var(--surface-card)" }}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-ts-orange" />
              Insurance Requirements
            </CardTitle>
            <CardDescription className="text-white/60">
              Ensure your insurance meets our minimum requirements for contractor verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {insuranceRequirements.map((req, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    alreadyVerified
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : req.required
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-blue-500/50 bg-blue-500/10"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{req.type}</h3>
                      <p className="text-sm text-white/60">{req.minimum} minimum</p>
                    </div>
                    {req.required && (
                      <Badge variant="error" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-white/70">{req.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/60">
              Upload one certificate covering your active coverage below — it's reviewed against
              these requirements.
            </p>
          </CardContent>
        </Card>

        {/* Upload Form */}
        <Card className="border-white/10 mb-8" style={{ backgroundColor: "var(--surface-card)" }}>
          <CardHeader>
            <CardTitle className="text-white">Insurance Certificate Upload</CardTitle>
            <CardDescription className="text-white/60">
              Upload clear, high-resolution images or PDFs of your insurance certificates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* General Liability */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">General Liability Insurance</h3>
                  <Badge variant="error">Required</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gl-policy" className="text-white/70">
                      Policy Number
                    </Label>
                    <Input
                      id="gl-policy"
                      placeholder="Enter policy number"
                      className="bg-white/10 border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gl-coverage" className="text-white/70">
                      Coverage Amount
                    </Label>
                    <Input
                      id="gl-coverage"
                      placeholder="e.g., $1,000,000"
                      className="bg-white/10 border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gl-carrier" className="text-white/70">
                      Insurance Carrier
                    </Label>
                    <Input
                      id="gl-carrier"
                      placeholder="Enter carrier name"
                      className="bg-white/10 border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gl-expiry" className="text-white/70">
                      Expiration Date
                    </Label>
                    <Input
                      id="gl-expiry"
                      type="date"
                      className="bg-white/10 border-white/15 text-white"
                    />
                  </div>
                </div>

                <div className="border-2 border-dashed border-white/15 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-white/60 mx-auto mb-4" />
                  <p className="text-white/70 mb-2">
                    Drop your certificate here or click to browse
                  </p>
                  <p className="text-sm text-white/60 mb-4">
                    Supported formats: PDF, JPG, PNG (Max 10MB)
                  </p>
                  {alreadyVerified ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Certificate verified</span>
                    </div>
                  ) : alreadySubmitted ? (
                    <div className="flex items-center justify-center gap-2 text-amber-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Submitted, pending review</span>
                    </div>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 px-4 py-2 text-sm text-white hover:border-ts-orange/50">
                      {isUploading ? "Uploading..." : "Select File"}
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleCertificateFile(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-400 mb-2">Certificate Requirements</h4>
                      <ul className="space-y-1 text-sm text-white/70">
                        <li>• Certificate must be current and not expired</li>
                        <li>• Coverage amounts must meet minimum requirements</li>
                        <li>• Certificate must show your business name exactly as registered</li>
                        <li>• Additional insured requirements may apply for certain projects</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-400 mb-2">Important Notes</h4>
                    <ul className="space-y-1 text-sm text-white/70">
                      <li>• Certificates are verified by our insurance partners</li>
                      <li>• Verification typically takes 1-2 business days</li>
                      <li>• You'll receive email notifications about verification status</li>
                      <li>• Expired certificates must be renewed to maintain verification</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {alreadyVerified && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Your certificate is verified.
          </div>
        )}
        {!alreadyVerified && alreadySubmitted && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Uploading a certificate above submits it for review automatically — no separate submit
            step needed.
          </div>
        )}
      </div>
    </div>
  );
});

export default InsuranceVerification;
