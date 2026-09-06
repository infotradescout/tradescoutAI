import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addressVerificationSubmissionSchema } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { getCurrentInternalPath, readSafeReturnPath } from "@/lib/postOnboardingRoute";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, Clock, Shield } from "lucide-react";

const addressFormSchema = addressVerificationSubmissionSchema.omit({
  documentUrl: true,
  documentType: true,
});
type AddressFormData = z.infer<typeof addressFormSchema>;
interface VerificationRecord {
  id: string;
  fullAddress: string;
  city: string;
  state: string;
  zipCode: string;
  verificationMethod: string;
  status: string;
  hasDocument: boolean;
  rejectionReason?: string | null;
}
interface VerificationStatus {
  verification: VerificationRecord | null;
  isVerified: boolean;
  deadline: string;
  daysRemaining: number;
  isExpired: boolean;
}
const documentMethods = [
  ["utility_bill", "Utility bill"],
  ["bank_statement", "Bank statement"],
  ["lease_agreement", "Lease agreement"],
  ["property_deed", "Property deed"],
] as const;

function AddressDocumentForm({
  userId,
  verification,
}: {
  userId: string;
  verification: VerificationRecord | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const active = useRef(true);
  const uploaded = useRef<{ file: File; objectKey: string } | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      fullAddress: verification?.fullAddress || "",
      city: verification?.city || "",
      state: verification?.state || "",
      zipCode: verification?.zipCode || "",
      verificationMethod: documentMethods.some(
        ([method]) => method === verification?.verificationMethod
      )
        ? (verification!.verificationMethod as AddressFormData["verificationMethod"])
        : "utility_bill",
    },
  });
  const submit = useMutation({
    mutationFn: async (data: AddressFormData) => {
      if (!file) throw new Error("Choose a document to upload.");
      const saved =
        uploaded.current?.file === file ? uploaded.current : await uploadPrivateObject(file);
      if (!active.current)
        throw new Error("The account or verification changed. Open the form again.");
      uploaded.current = { file, objectKey: saved.objectKey };
      return apiRequest(
        verification ? "PUT" : "POST",
        verification
          ? `/api/address-verification/${encodeURIComponent(verification.id)}`
          : "/api/address-verification",
        { ...data, documentUrl: saved.objectKey, documentType: file.type }
      );
    },
    onSuccess: async () => {
      if (!active.current) return;
      toast({
        title: "Document submitted",
        description: "Your address document is waiting for admin review.",
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/address-verification/status", userId],
      });
    },
    onError: (error) => {
      if (!active.current) return;
      toast({
        title: "Verification was not submitted",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });
  function chooseFile(next: File | null) {
    uploaded.current = null;
    setFile(null);
    if (!next) {
      setFileError("");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(next.type)) {
      setFileError("Choose a PDF, JPG, or PNG document.");
      return;
    }
    if (next.size === 0 || next.size > 10 * 1024 * 1024) {
      setFileError("Choose a nonempty document of 10 MB or less.");
      return;
    }
    setFileError("");
    setFile(next);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit proof of address</CardTitle>
        <CardDescription>
          Choose a document that shows your name and current address. You can cover balances and
          account numbers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((data) => {
            if (!file) {
              setFileError("Choose a PDF, JPG, or PNG document before submitting.");
              return;
            }
            setFileError("");
            submit.mutate(data);
          })}
        >
          <fieldset disabled={submit.isPending} className="space-y-5">
            {(
              [
                ["fullAddress", "Street address", "street-address", "123 Main Street, Apt 4B"],
                ["city", "City", "address-level2", "Hammond"],
                ["state", "State abbreviation", "address-level1", "LA"],
                ["zipCode", "ZIP code", "postal-code", "70401"],
              ] as const
            ).map(([name, label, autoComplete, placeholder]) => (
              <div className="space-y-2" key={name}>
                <Label htmlFor={`address-${name}`}>{label}</Label>
                <Input
                  id={`address-${name}`}
                  autoComplete={autoComplete}
                  placeholder={placeholder}
                  aria-invalid={Boolean(form.formState.errors[name])}
                  aria-describedby={
                    form.formState.errors[name] ? `address-${name}-error` : undefined
                  }
                  {...form.register(name)}
                />
                {form.formState.errors[name] && (
                  <p id={`address-${name}-error`} role="alert" className="text-sm text-destructive">
                    {form.formState.errors[name]?.message}
                  </p>
                )}
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="address-document-method">Document type</Label>
              <select
                id="address-document-method"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register("verificationMethod")}
              >
                {documentMethods.map(([method, label]) => (
                  <option key={method} value={method}>
                    {label}
                  </option>
                ))}
                <option value="postcard" disabled>
                  Postcard — unavailable
                </option>
                <option value="phone_verification" disabled>
                  Phone — unavailable
                </option>
              </select>
              {form.formState.errors.verificationMethod && (
                <p role="alert" className="text-sm text-destructive">
                  Choose an available document type.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-document">Address document</Label>
              <Input
                id="address-document"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                aria-describedby="address-document-help address-document-error"
                aria-invalid={Boolean(fileError)}
                onChange={(event) => chooseFile(event.target.files?.[0] || null)}
              />
              <p id="address-document-help" className="text-sm text-muted-foreground">
                PDF, JPG, or PNG, up to 10 MB. Your document is stored privately for admin review.
              </p>
              <p
                id="address-document-error"
                role={fileError ? "alert" : undefined}
                className="text-sm text-destructive"
              >
                {fileError}
              </p>
            </div>
            <Button type="submit" className="w-full">
              {submit.isPending ? "Uploading and submitting…" : "Submit document for review"}
            </Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AddressVerification() {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const userId = String(user?.id || "");
  const returnPath = readSafeReturnPath(getCurrentInternalPath(location));
  const status = useQuery<VerificationStatus>({
    queryKey: ["/api/address-verification/status", userId],
    queryFn: () => apiRequest("GET", "/api/address-verification/status"),
    enabled: isAuthenticated && Boolean(userId),
  });
  const verification = status.data?.verification || null;
  const waiting = verification?.status === "submitted" && verification.hasDocument;
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-3">
        <Shield className="h-8 w-8 text-ts-orange" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Address verification</h1>
        <p className="text-muted-foreground">
          Verify the address used by your TradeScout account with a private document review.
        </p>
        {returnPath && (
          <Button variant="outline" onClick={() => navigate(returnPath)}>
            Return to saved request
          </Button>
        )}
      </header>
      {!isAuthenticated ? (
        <Card>
          <CardHeader>
            <CardTitle>Sign in to verify your address</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() =>
                navigate(
                  `/pre-scout-setup?mode=signin&next=${encodeURIComponent(getCurrentInternalPath(location))}`
                )
              }
            >
              Sign in
            </Button>
          </CardContent>
        </Card>
      ) : status.isLoading ? (
        <p role="status">Loading verification status…</p>
      ) : status.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Verification status could not be loaded</AlertTitle>
          <AlertDescription>
            <Button variant="outline" onClick={() => status.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : status.data?.isVerified ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Address verified</AlertTitle>
          <AlertDescription>Your address verification is complete.</AlertDescription>
        </Alert>
      ) : (
        <>
          {waiting ? (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Document submitted for review</AlertTitle>
              <AlertDescription>
                Your address is not verified yet. An admin must review your document. You can return
                to your saved request while you wait.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {verification?.status === "rejected" && (
                <Alert variant="destructive">
                  <AlertTitle>Please update your document</AlertTitle>
                  <AlertDescription>
                    {verification.rejectionReason ||
                      "Submit a document that clearly shows your name and current address."}
                  </AlertDescription>
                </Alert>
              )}
              {verification &&
                ["postcard", "phone_verification"].includes(verification.verificationMethod) && (
                  <Alert>
                    <AlertTitle>Choose document verification</AlertTitle>
                    <AlertDescription>
                      Postcard and phone verification are unavailable. Submit an address document
                      below.
                    </AlertDescription>
                  </Alert>
                )}
              <AddressDocumentForm
                key={`${userId}:${verification?.id || "new"}`}
                userId={userId}
                verification={verification}
              />
            </>
          )}
          <p className="text-sm text-muted-foreground">
            Postcard and phone verification are currently unavailable.
          </p>
        </>
      )}
    </main>
  );
}
