import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 * - Banner: "Your TradeScout business page is live" + public URL
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
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoImageUrl, setSeoImageUrl] = useState("");
  const [profileSections, setProfileSections] = useState({
    about: true,
    rolesAndBadges: true,
    stats: true,
    services: true,
    marketplaceListings: true,
    reviews: true,
    communityActivity: false,
    contactCard: true,
  });
  const [themePreset, setThemePreset] = useState("default");
  const [themeColors, setThemeColors] = useState({
    primary: "",
    secondary: "",
    background: "",
    text: "",
  });
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState("");
  const [primaryCtaKind, setPrimaryCtaKind] = useState("direct_connect");
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState("");
  const [secondaryCtaKind, setSecondaryCtaKind] = useState("message");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [pricingTableEnabled, setPricingTableEnabled] = useState(false);
  const [bookingPriceUsd, setBookingPriceUsd] = useState("");
  const [bookingTimezone, setBookingTimezone] = useState("America/Chicago");
  const [contentBlocks, setContentBlocks] = useState<
    Array<{
      id: string;
      type: string;
      title?: string | null;
      body?: string | null;
      imageUrl?: string | null;
      secondaryBody?: string | null;
      ctaLabel?: string | null;
    }>
  >([]);
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
        setSeoTitle(data.seoMeta?.title || "");
        setSeoDescription(data.seoMeta?.description || "");
        setSeoImageUrl(data.seoMeta?.imageUrl || "");
        setProfileSections({
          about: data.profileSections?.about !== false,
          rolesAndBadges: data.profileSections?.rolesAndBadges !== false,
          stats: data.profileSections?.stats !== false,
          services: data.profileSections?.services !== false,
          marketplaceListings: data.profileSections?.marketplaceListings !== false,
          reviews: data.profileSections?.reviews !== false,
          communityActivity: data.profileSections?.communityActivity === true,
          contactCard: data.profileSections?.contactCard !== false,
        });
        setThemePreset(data.theme?.preset || "default");
        setThemeColors({
          primary: data.theme?.customColors?.primary || "",
          secondary: data.theme?.customColors?.secondary || "",
          background: data.theme?.customColors?.background || "",
          text: data.theme?.customColors?.text || "",
        });
        setPrimaryCtaLabel(data.ctaConfig?.primary?.label || "");
        setPrimaryCtaKind(data.ctaConfig?.primary?.kind || "direct_connect");
        setSecondaryCtaLabel(data.ctaConfig?.secondary?.label || "");
        setSecondaryCtaKind(data.ctaConfig?.secondary?.kind || "message");
        setBookingEnabled(data.bookingConfig?.enabled === true);
        setPricingTableEnabled(data.bookingConfig?.pricingTableEnabled === true);
        setBookingPriceUsd(
          typeof data.bookingConfig?.bookingPriceUsd === "number"
            ? String(data.bookingConfig.bookingPriceUsd)
            : ""
        );
        setBookingTimezone(data.bookingConfig?.timezone || "America/Chicago");
        setContentBlocks(Array.isArray(data.contentBlocks) ? data.contentBlocks : []);
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
      const safeParsedBlocks = contentBlocks.map((block) => ({
        id: String(block.id || crypto.randomUUID()),
        type: String(block.type || "text"),
        title: block.title?.trim() || undefined,
        body: block.body?.trim() || undefined,
        imageUrl: block.imageUrl?.trim() || undefined,
        secondaryBody: block.secondaryBody?.trim() || undefined,
        ctaLabel: block.ctaLabel?.trim() || undefined,
      }));

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
        seoMeta: {
          title: seoTitle.trim() || undefined,
          description: seoDescription.trim() || undefined,
          imageUrl: seoImageUrl.trim() || undefined,
        },
        profileSections,
        theme: {
          preset: themePreset || undefined,
          customColors: {
            primary: themeColors.primary || undefined,
            secondary: themeColors.secondary || undefined,
            background: themeColors.background || undefined,
            text: themeColors.text || undefined,
          },
        },
        ctaConfig: {
          primary: { label: primaryCtaLabel.trim() || undefined, kind: primaryCtaKind as any },
          secondary: {
            label: secondaryCtaLabel.trim() || undefined,
            kind: secondaryCtaKind as any,
          },
        },
        bookingConfig: {
          enabled: bookingEnabled,
          pricingTableEnabled,
          bookingPriceUsd: bookingPriceUsd ? Number(bookingPriceUsd) : 0,
          timezone: bookingTimezone,
          calendarVisibility: "public",
          slots: [],
          pricingRows: [],
        },
        contentBlocks: safeParsedBlocks,
        visibility: "public",
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

  function addContentBlock() {
    setContentBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "text",
        title: "",
        body: "",
        imageUrl: "",
        secondaryBody: "",
        ctaLabel: "",
      },
    ]);
  }

  function getContentBlockHelp(type: string) {
    switch (type) {
      case "hero":
        return "Hero block: title as headline, body as supporting text, image URL optional.";
      case "gallery":
        return "Gallery block: title as section name, body as short intro, image URL as featured image.";
      case "faq":
        return "FAQ block: title as question, body as answer.";
      case "proof":
        return "Proof block: title as proof item, body as details or testimonial.";
      case "cta":
        return "CTA block: title as CTA heading, body as CTA supporting text.";
      default:
        return "Text block: title + body, with optional image URL.";
    }
  }

  function updateContentBlock(
    id: string,
    field: "type" | "title" | "body" | "imageUrl" | "secondaryBody" | "ctaLabel",
    value: string
  ) {
    setContentBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, [field]: value } : block))
    );
  }

  function removeContentBlock(id: string) {
    setContentBlocks((current) => current.filter((block) => block.id !== id));
  }

  async function copyDomainValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: value });
    } catch {
      toast({ title: `Could not copy ${label.toLowerCase()}`, variant: "destructive" as any });
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
            <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="coverage">Coverage</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="ctas">CTAs</TabsTrigger>
              <TabsTrigger value="booking">Booking</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
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
                Coverage and address settings are now managed in the unified public page settings
                flow so user and business addresses stay separate.
              </p>
              <Button variant="outline" onClick={() => navigate(`/u/${profile.slug}/edit`)}>
                Open unified public page settings
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
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <Label htmlFor="customDomain">Custom Domain</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Connect your own domain and use this TradeScout page as your free website
                        equivalent.
                      </p>
                    </div>
                    <Badge variant="secondary">{domainState}</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div className="rounded border p-3">
                      <div className="font-medium">Default TradeScout URL</div>
                      <div className="text-muted-foreground break-all mt-1">
                        tradescout.com{publicUrl}
                      </div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="font-medium">Your domain</div>
                      <div className="text-muted-foreground break-all mt-1">
                        {profile.customDomainVerification?.state === "verified" &&
                        profile.customDomain
                          ? `https://${profile.customDomain}`
                          : domainInput
                            ? `https://${domainInput}`
                            : "Not connected yet"}
                      </div>
                    </div>
                  </div>
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
                    onClick={() => copyDomainValue("TradeScout URL", `tradescout.com${publicUrl}`)}
                  >
                    Copy TradeScout URL
                  </Button>
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

                {profile.customDomainVerification?.state === "verified" && profile.customDomain ? (
                  <Alert>
                    <AlertDescription className="space-y-3 text-xs">
                      <div>
                        <strong>Your website is live on your custom domain.</strong>
                      </div>
                      <div className="break-all">https://{profile.customDomain}</div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyDomainValue("Custom domain", `https://${profile.customDomain}`)
                          }
                        >
                          Copy Website URL
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `https://${profile.customDomain}`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          Open Website
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {profile.customDomain && domainToken && (
                  <Alert>
                    <AlertDescription className="space-y-2 text-xs">
                      <div>
                        Add this DNS TXT record at your registrar, then click{" "}
                        <strong>Verify Domain</strong>.
                      </div>
                      <div className="rounded border bg-background p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div>
                              <strong>Host</strong>
                            </div>
                            <div className="break-all">
                              _tradescout-verify.{profile.customDomain}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              copyDomainValue(
                                "DNS host",
                                `_tradescout-verify.${profile.customDomain}`
                              )
                            }
                          >
                            Copy Host
                          </Button>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div>
                              <strong>Value</strong>
                            </div>
                            <div className="break-all">{domainToken}</div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyDomainValue("DNS value", domainToken)}
                          >
                            Copy Value
                          </Button>
                        </div>
                      </div>
                      <div className="text-muted-foreground">
                        Once verified, visitors can use your domain as the main website for this
                        business page.
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

            <TabsContent value="seo" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">SEO Title</Label>
                <Input
                  id="seoTitle"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Business title for search/social"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoDescription">SEO Description</Label>
                <Textarea
                  id="seoDescription"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Short description for search/social"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoImageUrl">SEO Image URL</Label>
                <Input
                  id="seoImageUrl"
                  value={seoImageUrl}
                  onChange={(e) => setSeoImageUrl(e.target.value)}
                  placeholder="https://example.com/social-image.png"
                />
              </div>
            </TabsContent>

            <TabsContent value="theme" className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="themePreset">Theme Preset</Label>
                <Input
                  id="themePreset"
                  value={themePreset}
                  onChange={(e) => setThemePreset(e.target.value)}
                  placeholder="default"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary</Label>
                  <Input
                    value={themeColors.primary}
                    onChange={(e) => setThemeColors({ ...themeColors, primary: e.target.value })}
                    placeholder="Primary brand color"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secondary</Label>
                  <Input
                    value={themeColors.secondary}
                    onChange={(e) => setThemeColors({ ...themeColors, secondary: e.target.value })}
                    placeholder="Secondary brand color"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Background</Label>
                  <Input
                    value={themeColors.background}
                    onChange={(e) => setThemeColors({ ...themeColors, background: e.target.value })}
                    placeholder="Background color"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Text</Label>
                  <Input
                    value={themeColors.text}
                    onChange={(e) => setThemeColors({ ...themeColors, text: e.target.value })}
                    placeholder="Text color"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sections" className="space-y-4 mt-6">
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(profileSections).map(([key, enabled]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded border p-3 text-sm"
                  >
                    <span>{key}</span>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) =>
                        setProfileSections({ ...profileSections, [key]: e.target.checked })
                      }
                    />
                  </label>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ctas" className="space-y-4 mt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary CTA Label</Label>
                  <Input
                    value={primaryCtaLabel}
                    onChange={(e) => setPrimaryCtaLabel(e.target.value)}
                    placeholder="Request a quote"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Primary CTA Kind</Label>
                  <Input
                    value={primaryCtaKind}
                    onChange={(e) => setPrimaryCtaKind(e.target.value)}
                    placeholder="direct_connect"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secondary CTA Label</Label>
                  <Input
                    value={secondaryCtaLabel}
                    onChange={(e) => setSecondaryCtaLabel(e.target.value)}
                    placeholder="Message"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secondary CTA Kind</Label>
                  <Input
                    value={secondaryCtaKind}
                    onChange={(e) => setSecondaryCtaKind(e.target.value)}
                    placeholder="message"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="booking" className="space-y-4 mt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center justify-between rounded border p-3 text-sm">
                  <span>Enable Booking</span>
                  <input
                    type="checkbox"
                    checked={bookingEnabled}
                    onChange={(e) => setBookingEnabled(e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded border p-3 text-sm">
                  <span>Enable Pricing Table</span>
                  <input
                    type="checkbox"
                    checked={pricingTableEnabled}
                    onChange={(e) => setPricingTableEnabled(e.target.checked)}
                  />
                </label>
                <div className="space-y-2">
                  <Label>Booking Price (USD)</Label>
                  <Input
                    value={bookingPriceUsd}
                    onChange={(e) => setBookingPriceUsd(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={bookingTimezone}
                    onChange={(e) => setBookingTimezone(e.target.value)}
                    placeholder="America/Chicago"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Content Blocks</Label>
                  <p className="text-sm text-muted-foreground">
                    Build extra sections for your public business website page.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addContentBlock}>
                  + Add Block
                </Button>
              </div>

              {contentBlocks.length === 0 ? (
                <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                  No content blocks yet. Add one to create an extra section on your public page.
                </div>
              ) : (
                <div className="space-y-4">
                  {contentBlocks.map((block, idx) => (
                    <Card key={block.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-base">Block {idx + 1}</CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContentBlock(block.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={block.type || "text"}
                            onValueChange={(value) => updateContentBlock(block.id, "type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a block type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="hero">Hero</SelectItem>
                              <SelectItem value="gallery">Gallery</SelectItem>
                              <SelectItem value="faq">FAQ</SelectItem>
                              <SelectItem value="proof">Proof</SelectItem>
                              <SelectItem value="cta">CTA</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {getContentBlockHelp(block.type || "text")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={block.title || ""}
                            onChange={(e) => updateContentBlock(block.id, "title", e.target.value)}
                            placeholder="Section title"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {block.type === "faq"
                              ? "Answer"
                              : block.type === "proof"
                                ? "Primary Proof Text"
                                : block.type === "cta"
                                  ? "Supporting Text"
                                  : "Body"}
                          </Label>
                          <Textarea
                            value={block.body || ""}
                            onChange={(e) => updateContentBlock(block.id, "body", e.target.value)}
                            rows={5}
                            placeholder="Section content"
                          />
                        </div>

                        {(block.type === "faq" || block.type === "proof") && (
                          <div className="space-y-2">
                            <Label>
                              {block.type === "faq"
                                ? "Short follow-up / extra note"
                                : "Testimonial / evidence detail"}
                            </Label>
                            <Textarea
                              value={block.secondaryBody || ""}
                              onChange={(e) =>
                                updateContentBlock(block.id, "secondaryBody", e.target.value)
                              }
                              rows={3}
                              placeholder={
                                block.type === "faq"
                                  ? "Optional follow-up detail"
                                  : "Optional testimonial, certification note, or evidence detail"
                              }
                            />
                          </div>
                        )}

                        {block.type === "cta" && (
                          <div className="space-y-2">
                            <Label>CTA Button Label</Label>
                            <Input
                              value={block.ctaLabel || ""}
                              onChange={(e) =>
                                updateContentBlock(block.id, "ctaLabel", e.target.value)
                              }
                              placeholder="Request a quote"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Image URL</Label>
                          <Input
                            value={block.imageUrl || ""}
                            onChange={(e) =>
                              updateContentBlock(block.id, "imageUrl", e.target.value)
                            }
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
