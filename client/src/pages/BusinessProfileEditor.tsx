import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Eye, MapPin, ExternalLink, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BusinessProfile, UpdateProfilePayload } from "@/../../shared/businessProfile";
import { recordActivity } from "@/agent/activity";
import { ScoutCopyAssistModal } from "@/components/business/ScoutCopyAssistModal";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  generateCopyVariants,
  recordCopyAssistTelemetry,
  type ScoutCopyVariant,
} from "@/agent/tools/scoutCopyAssist";

/**
 * BusinessProfileEditor
 *
 * Edit view at /business/:slug/edit
 *
 * Contract:
 * - Fetches via GET /api/business-profile/me
 * - Saves via PATCH /api/business-profile/me
 * - Tabs: About | Services | Coverage | Contact
 * - Inline save with success toast
 * - Banner: "Your TradeScout page is live" + public URL
 * - Telemetry: business_profile_edit_opened, business_profile_updated
 */
export default function BusinessProfileEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [serviceAreasText, setServiceAreasText] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [domainStarting, setDomainStarting] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState(false);

  // Scout Copy Assist state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyVariants, setCopyVariants] = useState<ScoutCopyVariant[]>([]);
  const [copyAssistLoading, setCopyAssistLoading] = useState(false);
  const [copyAssistField, setCopyAssistField] = useState<"description" | "headline" | "services">(
    "description"
  );

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/business-profile/me");

        if (!response.ok) {
          if (response.status === 404) {
            setError("No business profile found. Please publish your profile first.");
          } else {
            setError("Failed to load profile");
          }
          setLoading(false);
          return;
        }

        const data: BusinessProfile = await response.json();

        // Verify ownership by slug match
        if (data.slug !== slug) {
          setError("You do not own this business profile");
          setLoading(false);
          return;
        }

        setProfile(data);
        setBusinessName(data.name || "");
        setHeadline(data.headline || "");
        setDescription(data.description || "");
        setServices(data.services || []);
        setWebsite(data.website || "");
        setServiceAreasText((data.serviceAreas || []).join(", "));
        setDomainInput(data.customDomain || "");

        // Non-optional telemetry
        recordActivity({
          type: "business_profile_edit_opened" as any,
          ts: new Date().toISOString(),
          path: window.location.pathname,
          meta: {
            slug: data.slug,
          },
        });
      } catch (err) {
        console.error("Error loading business profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [slug]);

  async function handleGenerateCopyVariants(field: "description" | "headline" | "services") {
    if (!profile) return;

    setCopyAssistField(field);
    setCopyAssistLoading(true);
    recordCopyAssistTelemetry("opened");

    try {
      const response = await generateCopyVariants({
        field,
        businessName: businessName.trim(),
        countyName: profile.countyName || "",
        stateCode: profile.stateCode,
        serviceAreas: serviceAreasText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        existingDescription: description.trim(),
        existingHeadline: headline.trim(),
        existingServices: services,
        userType: "business_owner",
      });

      setCopyVariants(response.data?.variants || []);
      setShowCopyModal(true);
    } catch (err) {
      console.error("Error generating copy variants:", err);
      toast({
        title: "Copy assist failed",
        description: "Could not generate variants. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCopyAssistLoading(false);
    }
  }

  function handleCopyVariantAccept(variantId: "safe" | "growth") {
    const variant = copyVariants.find((v) => v.id === variantId);
    if (!variant) return;

    if (copyAssistField === "description") {
      setDescription(variant.text);
    } else if (copyAssistField === "headline") {
      setHeadline(variant.text);
    } else if (copyAssistField === "services") {
      // Services come back as bullet points; split by newline
      const bullets = variant.text
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s && !s.match(/^[-•*]\s*/))
        .map((s) => s.replace(/^[-•*]\s*/, ""));
      setServices(bullets);
    }
    setShowCopyModal(false);
  }

  async function handleSave() {
    if (!profile) return;

    setSaving(true);

    try {
      const payload: UpdateProfilePayload = {
        name: businessName.trim() || undefined,
        headline: headline.trim() || undefined,
        description: description.trim() || undefined,
        services: services.filter(Boolean),
        website: website.trim() || undefined,
        serviceAreas: serviceAreasText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const response = await fetch("/api/business-profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      const updated: BusinessProfile = await response.json();
      setProfile(updated);

      toast({
        title: "Profile updated",
        description: "Your business profile is live.",
      });

      // Non-optional telemetry
      recordActivity({
        type: "business_profile_updated" as any,
        ts: new Date().toISOString(),
        path: window.location.pathname,
        meta: {
          slug: updated.slug,
        },
      });
    } catch (err) {
      console.error("Error saving profile:", err);
      toast({
        title: "Save failed",
        description: "Could not save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStartDomainVerification() {
    if (!profile) return;

    const normalized = domainInput.trim().toLowerCase();
    if (!normalized) {
      toast({
        title: "Enter a domain",
        description: "Add your domain first (for example: example.com).",
        variant: "destructive",
      });
      return;
    }

    setDomainStarting(true);
    try {
      const response = await fetch("/api/business-profile/domain/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalized }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Failed to start domain verification");
      }

      if (data?.profile) {
        setProfile(data.profile as BusinessProfile);
        setDomainInput((data.profile as BusinessProfile).customDomain || normalized);
      }

      toast({
        title: "Verification started",
        description: "Add the TXT record shown below, then click Verify Domain.",
      });
    } catch (err: any) {
      console.error("Error starting domain verification:", err);
      toast({
        title: "Could not start verification",
        description: formatUserFacingErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setDomainStarting(false);
    }
  }

  async function handleVerifyDomain() {
    if (!profile?.customDomain) {
      toast({
        title: "No domain configured",
        description: "Start verification first.",
        variant: "destructive",
      });
      return;
    }

    setDomainVerifying(true);
    try {
      const response = await fetch("/api/business-profile/domain/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json().catch(() => null);
      if (data?.profile) {
        setProfile(data.profile as BusinessProfile);
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.verification?.error || data?.message || "Verification failed");
      }

      toast({
        title: "Domain verified",
        description: "Your domain now points to your public business profile.",
      });
    } catch (err: any) {
      console.error("Error verifying domain:", err);
      toast({
        title: "Verification failed",
        description: formatUserFacingErrorMessage(
          err,
          "DNS may still be propagating. Try again soon."
        ),
        variant: "destructive",
      });
    } finally {
      setDomainVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Cannot edit profile</h2>
              <p className="text-muted-foreground mb-6">{error || "Profile not found"}</p>
              <Button onClick={() => navigate("/scout")}>Go to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const publicUrl = `/business/${profile.slug}`;
  const domainState = profile.customDomainVerification?.state || "unverified";
  const domainToken = profile.customDomainVerification?.token || "";

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Live Banner */}
      <Alert className="mb-6">
        <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
          <span className="text-sm">
            <strong>Your TradeScout page is live:</strong>{" "}
            <a
              href={publicUrl}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              tradescout.com{publicUrl}
            </a>
          </span>
          <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Edit Business Profile</CardTitle>
          <CardDescription>
            Update your public business information. Changes save immediately.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="coverage">Coverage</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your Business Name"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="headline">Headline (60–80 chars)</Label>
                  <Button
                    onClick={() => handleGenerateCopyVariants("headline")}
                    variant="ghost"
                    size="sm"
                    disabled={copyAssistLoading || !businessName.trim()}
                    className="gap-1 text-xs"
                  >
                    <Sparkles className="h-3 w-3" />
                    Improve with Scout
                  </Button>
                </div>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value.substring(0, 80))}
                  placeholder="e.g., Licensed HVAC Services in Travis County"
                  maxLength={80}
                />
                <p className="text-xs text-muted-foreground">{headline.length} / 80 characters</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Description</Label>
                  <Button
                    onClick={() => handleGenerateCopyVariants("description")}
                    variant="ghost"
                    size="sm"
                    disabled={copyAssistLoading || !businessName.trim()}
                    className="gap-1 text-xs"
                  >
                    <Sparkles className="h-3 w-3" />
                    Improve with Scout
                  </Button>
                </div>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell your community about your business..."
                  rows={8}
                />
                <p className="text-sm text-muted-foreground">
                  Describe what you do, your expertise, and why customers should choose you.
                </p>
                <p className="text-xs text-muted-foreground">{description.length} characters</p>
              </div>
            </TabsContent>

            <TabsContent value="services" className="space-y-4 mt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="services">Services (3–5 bullet points)</Label>
                  <Button
                    onClick={() => handleGenerateCopyVariants("services")}
                    variant="ghost"
                    size="sm"
                    disabled={copyAssistLoading || !businessName.trim()}
                    className="gap-1 text-xs"
                  >
                    <Sparkles className="h-3 w-3" />
                    Improve with Scout
                  </Button>
                </div>
                <div className="space-y-2">
                  {services.map((service, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Input
                        value={service}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[idx] = e.target.value.substring(0, 80);
                          setServices(updated);
                        }}
                        maxLength={80}
                        placeholder={`Service ${idx + 1} (e.g., Installation, Repair, Maintenance)`}
                        className="flex-1"
                      />
                      {services.length > 1 && (
                        <Button
                          onClick={() => setServices(services.filter((_, i) => i !== idx))}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  {services.length < 5 && (
                    <Button
                      onClick={() => setServices([...services, ""])}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      + Add Service
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  List key services you offer (1–5). Keep each under 80 characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceAreas">Service Areas (comma-separated)</Label>
                <Input
                  id="serviceAreas"
                  value={serviceAreasText}
                  onChange={(e) => setServiceAreasText(e.target.value)}
                  placeholder="Dallas County, Collin County, Denton County"
                />
                <p className="text-sm text-muted-foreground">
                  List the counties or cities you serve.
                </p>
              </div>

              {serviceAreasText && (
                <div className="pt-2">
                  <Label className="mb-2 block">Preview</Label>
                  <div className="flex flex-wrap gap-2">
                    {serviceAreasText
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((area, idx) => (
                        <Badge key={idx} variant="secondary">
                          <MapPin className="h-3 w-3 mr-1" />
                          {area}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="coverage" className="space-y-4 mt-6">
              <Alert>
                <AlertDescription>
                  <strong>Current location:</strong>{" "}
                  {[profile.city, profile.countyName, profile.stateCode].filter(Boolean).join(", ")}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Coverage and address settings are now managed in the unified Edit Public Profile
                flow so user and business addresses stay separate.
              </p>
              <Button variant="outline" onClick={() => navigate(`/u/${profile.slug}/edit`)}>
                Open unified public profile settings
              </Button>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Test link
                </a>
              )}

              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <Label htmlFor="customDomain">Custom Domain</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Connect your domain so visitors land on this profile directly.
                    </p>
                  </div>
                  <Badge variant="secondary">{domainState}</Badge>
                </div>

                <Input
                  id="customDomain"
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="example.com"
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleStartDomainVerification}
                    disabled={domainStarting}
                  >
                    {domainStarting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      "Start Verification"
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleVerifyDomain}
                    disabled={domainVerifying || !profile.customDomain || !domainToken}
                  >
                    {domainVerifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Domain"
                    )}
                  </Button>
                </div>

                {profile.customDomain && domainToken && (
                  <Alert>
                    <AlertDescription className="space-y-1 text-xs">
                      <div>
                        Add this DNS TXT record at your registrar, then click{" "}
                        <strong>Verify Domain</strong>.
                      </div>
                      <div>
                        <strong>Host:</strong> _tradescout-verify.{profile.customDomain}
                      </div>
                      <div className="break-all">
                        <strong>Value:</strong> {domainToken}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {profile.customDomainVerification?.error && (
                  <p className="text-xs text-destructive">
                    {profile.customDomainVerification.error}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>

            <Button variant="outline" onClick={() => navigate(publicUrl)}>
              <Eye className="h-4 w-4 mr-2" />
              View Public Profile
            </Button>

            <Button variant="ghost" onClick={() => navigate("/scout")}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <ScoutCopyAssistModal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        variants={copyVariants}
        currentDescription={description}
        onAccept={handleCopyVariantAccept}
        isLoading={copyAssistLoading}
        field={copyAssistField}
      />
    </div>
  );
}
