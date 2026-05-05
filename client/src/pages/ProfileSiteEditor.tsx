import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { COLOR_PRESETS, getPresetNames } from "@shared/colorPresets";
import { StateCountySelector } from "@/components/state-county-selector";

type OwnedProfile = {
  id: string;
  slug: string;
  displayName: string;
  roleContext: string;
  status: "draft" | "published";
};

type ProfileDetail = OwnedProfile & {
  headline: string | null;
  businessId: string | null;
  contentBlocks: any;
  ctaConfig: any;
  seoMeta: any;
};

type BusinessProfileLocation = {
  city?: string | null;
  stateCode?: string | null;
  countyFips?: string | null;
  countyName?: string | null;
  address?: string | null;
  zipCode?: string | null;
};

type UserLocationSettings = {
  address: string;
  city: string;
  stateCode: string;
  countyFips: string;
  countyName: string;
  zipCode: string;
};

type ProfileSections = {
  about?: boolean;
  rolesAndBadges?: boolean;
  stats?: boolean;
  services?: boolean;
  marketplaceListings?: boolean;
  reviews?: boolean;
  communityActivity?: boolean;
  contactCard?: boolean;
};

type ProfileBookingSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label?: string;
  active?: boolean;
};

type ProfilePricingRow = {
  id: string;
  name: string;
  priceLabel: string;
  description?: string;
};

type ProfileBookingSettings = {
  enabled?: boolean;
  paidBookings?: boolean;
  bookingPriceUsd?: number;
  calendarVisibility?: "public" | "private";
  timezone?: string;
  slots?: ProfileBookingSlot[];
  pricingTableEnabled?: boolean;
  pricingRows?: ProfilePricingRow[];
};

const PROFILE_SECTION_OPTIONS: Array<{
  key: keyof ProfileSections;
  label: string;
  description: string;
}> = [
  { key: "about", label: "About", description: "Headline and summary block." },
  { key: "rolesAndBadges", label: "Roles & badges", description: "Role chips and trust badges." },
  { key: "stats", label: "Stats", description: "Platform stats and profile highlights." },
  { key: "services", label: "Services", description: "Services summary and scope." },
  {
    key: "marketplaceListings",
    label: "Exchange listings",
    description: "Active Exchange listings connected to this profile.",
  },
  {
    key: "reviews",
    label: "Recommendations",
    description: "Public recommendations from people you've worked with.",
  },
  {
    key: "communityActivity",
    label: "Community activity",
    description: "Recent community posts and interactions.",
  },
  {
    key: "contactCard",
    label: "Contact card",
    description: "Protected contact entry through TradeScout.",
  },
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function buildDefaultBooking(): ProfileBookingSettings {
  return {
    enabled: false,
    paidBookings: false,
    bookingPriceUsd: 0,
    calendarVisibility: "public",
    timezone: "America/Chicago",
    slots: [],
    pricingTableEnabled: false,
    pricingRows: [],
  };
}

export default function ProfileSiteEditor() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [matchU, paramsU] = useRoute("/u/:slug/edit");
  const [, paramsP] = useRoute("/p/:slug/edit");
  const [, setLocation] = useLocation();

  const slug = (paramsU?.slug || paramsP?.slug || "").trim();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [contentBlocksText, setContentBlocksText] = useState("[]");
  const [ctaConfigText, setCtaConfigText] = useState("{}");
  const [seoMetaText, setSeoMetaText] = useState("{}");
  const [customDomain, setCustomDomain] = useState("");
  const [profileVisibility, setProfileVisibility] = useState<"public" | "private">(
    user?.preferences?.profileVisibility === "public" ? "public" : "private"
  );
  const [servicesDescription, setServicesDescription] = useState("");
  const [profileSections, setProfileSections] = useState<ProfileSections>({});
  const [profileBooking, setProfileBooking] = useState<ProfileBookingSettings>(buildDefaultBooking);
  const [colorPreset, setColorPreset] = useState<string>("default");
  const [customColors, setCustomColors] = useState<{
    primary: string;
    secondary: string;
    background: string;
    text: string;
  }>({
    primary: COLOR_PRESETS.default.primary,
    secondary: COLOR_PRESETS.default.secondary,
    background: COLOR_PRESETS.default.background,
    text: COLOR_PRESETS.default.text,
  });
  const [savingPublicSettings, setSavingPublicSettings] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocationSettings>({
    address: "",
    city: "",
    stateCode: "",
    countyFips: "",
    countyName: "",
    zipCode: "",
  });
  const [businessLocation, setBusinessLocation] = useState<BusinessProfileLocation>({
    address: "",
    city: "",
    stateCode: "",
    countyFips: "",
    countyName: "",
    zipCode: "",
  });
  const [hasBusinessProfile, setHasBusinessProfile] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;

      try {
        const listRes = await apiRequest("GET", "/api/profiles");
        const list = (await listRes.json()) as OwnedProfile[];
        const found = list.find((p) => p.slug === slug);
        if (!found) {
          setProfile(null);
          return;
        }

        const detailRes = await apiRequest("GET", `/api/profiles/${found.id}`);
        const detail = (await detailRes.json()) as ProfileDetail;
        setProfile(detail);

        setDisplayName(detail.displayName || "");
        setHeadline(detail.headline || "");
        setContentBlocksText(JSON.stringify(detail.contentBlocks ?? [], null, 2));
        setCtaConfigText(JSON.stringify(detail.ctaConfig ?? {}, null, 2));
        setSeoMetaText(JSON.stringify(detail.seoMeta ?? {}, null, 2));
        setCustomDomain(String(detail.seoMeta?.customDomain || ""));
      } catch (error: any) {
        console.error("Error loading profile:", error);
        toast({
          title: "Could not load profile",
          description: formatUserFacingErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug, toast]);

  useEffect(() => {
    const loadPublicSettings = async () => {
      if (!slug) return;
      try {
        const prefsRes = await apiRequest("GET", "/api/users/preferences");
        const prefsPayload = await prefsRes.json().catch(() => ({}) as any);
        const prefs =
          prefsPayload && typeof prefsPayload.preferences === "object"
            ? prefsPayload.preferences
            : prefsPayload;

        const visibility =
          prefs?.profileVisibility === "public" || prefs?.profileVisibility === "private"
            ? prefs.profileVisibility
            : user?.preferences?.profileVisibility === "public"
              ? "public"
              : "private";
        setProfileVisibility(visibility);
        setServicesDescription(
          typeof prefs?.servicesDescription === "string" ? prefs.servicesDescription : ""
        );
        setProfileSections(
          prefs?.profileSections && typeof prefs.profileSections === "object"
            ? prefs.profileSections
            : {}
        );
        setProfileBooking(
          prefs?.profileBooking && typeof prefs.profileBooking === "object"
            ? {
                ...buildDefaultBooking(),
                ...prefs.profileBooking,
                slots: Array.isArray(prefs.profileBooking.slots) ? prefs.profileBooking.slots : [],
                pricingRows: Array.isArray(prefs.profileBooking.pricingRows)
                  ? prefs.profileBooking.pricingRows
                  : [],
              }
            : buildDefaultBooking()
        );

        const preset =
          typeof prefs?.colorScheme?.preset === "string" ? prefs.colorScheme.preset : "default";
        setColorPreset(preset);
        setCustomColors({
          primary: prefs?.colorScheme?.primary || COLOR_PRESETS.default.primary,
          secondary: prefs?.colorScheme?.secondary || COLOR_PRESETS.default.secondary,
          background: prefs?.colorScheme?.background || COLOR_PRESETS.default.background,
          text: prefs?.colorScheme?.text || COLOR_PRESETS.default.text,
        });

        const userProfileRes = await apiRequest("GET", "/api/user/profile");
        const userProfile = await userProfileRes.json().catch(() => ({}) as any);
        setUserLocation({
          address: typeof userProfile?.address === "string" ? userProfile.address : "",
          city: typeof userProfile?.city === "string" ? userProfile.city : "",
          stateCode:
            typeof userProfile?.stateCode === "string"
              ? userProfile.stateCode
              : typeof userProfile?.state === "string"
                ? userProfile.state
                : "",
          countyFips: typeof userProfile?.countyFips === "string" ? userProfile.countyFips : "",
          countyName:
            typeof userProfile?.countyName === "string"
              ? userProfile.countyName
              : typeof userProfile?.county === "string"
                ? userProfile.county
                : "",
          zipCode: typeof userProfile?.zipCode === "string" ? userProfile.zipCode : "",
        });

        try {
          const businessProfileRes = await apiRequest("GET", "/api/business-profile/me");
          const businessProfile = await businessProfileRes.json().catch(() => ({}) as any);
          setHasBusinessProfile(true);
          setBusinessLocation({
            address: typeof businessProfile?.address === "string" ? businessProfile.address : "",
            city: typeof businessProfile?.city === "string" ? businessProfile.city : "",
            stateCode:
              typeof businessProfile?.stateCode === "string" ? businessProfile.stateCode : "",
            countyFips:
              typeof businessProfile?.countyFips === "string" ? businessProfile.countyFips : "",
            countyName:
              typeof businessProfile?.countyName === "string" ? businessProfile.countyName : "",
            zipCode: typeof businessProfile?.zipCode === "string" ? businessProfile.zipCode : "",
          });
        } catch {
          setHasBusinessProfile(false);
          setBusinessLocation({
            address: "",
            city: "",
            stateCode: "",
            countyFips: "",
            countyName: "",
            zipCode: "",
          });
        }
      } catch (error: any) {
        toast({
          title: "Could not load public settings",
          description: formatUserFacingErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    };

    void loadPublicSettings();
  }, [slug, toast, user?.preferences?.profileVisibility]);

  useEffect(() => {
    if (matchU || !slug) return;
    setLocation(`/u/${encodeURIComponent(slug)}/edit`);
  }, [matchU, setLocation, slug]);

  const parsedPayload = useMemo(() => {
    try {
      return {
        contentBlocks: JSON.parse(contentBlocksText || "[]"),
        ctaConfig: JSON.parse(ctaConfigText || "{}"),
        seoMeta: JSON.parse(seoMetaText || "{}"),
      };
    } catch {
      return null;
    }
  }, [contentBlocksText, ctaConfigText, seoMetaText]);

  const save = async () => {
    if (!profile) return;
    if (!parsedPayload) {
      toast({
        title: "Invalid JSON",
        description: "Fix contentBlocks / ctaConfig / seoMeta JSON before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      const allowedBlockTypes = new Set([
        "hero",
        "about",
        "services",
        "gallery",
        "faq",
        "reviews",
        "cta",
        "custom",
      ]);

      const normalizeContentBlocks = Array.isArray(parsedPayload.contentBlocks)
        ? parsedPayload.contentBlocks
            .filter((block: any) => block && typeof block === "object")
            .map((block: any) => ({
              type: allowedBlockTypes.has(String(block.type || "")) ? String(block.type) : "custom",
              data:
                block.data && typeof block.data === "object" && !Array.isArray(block.data)
                  ? block.data
                  : {},
            }))
        : [];

      const normalizeCta = (cta: any) => {
        if (!cta || typeof cta !== "object") return undefined;
        const label = typeof cta.label === "string" ? cta.label.trim() : "";
        const kind = typeof cta.kind === "string" ? cta.kind.trim() : "";
        const value = typeof cta.value === "string" ? cta.value.trim() : "";
        if (!label || !kind || !value) return undefined;
        return { label, kind, value };
      };

      const normalizedCtaConfig = {
        ...(normalizeCta((parsedPayload.ctaConfig as any)?.primary)
          ? { primary: normalizeCta((parsedPayload.ctaConfig as any)?.primary) }
          : {}),
        ...(normalizeCta((parsedPayload.ctaConfig as any)?.secondary)
          ? { secondary: normalizeCta((parsedPayload.ctaConfig as any)?.secondary) }
          : {}),
      };

      const seoMetaFromText =
        parsedPayload.seoMeta && typeof parsedPayload.seoMeta === "object"
          ? { ...(parsedPayload.seoMeta as Record<string, unknown>) }
          : {};
      const normalizedDomain = customDomain.trim().toLowerCase();
      if (normalizedDomain) {
        seoMetaFromText.customDomain = normalizedDomain;
      } else {
        delete (seoMetaFromText as any).customDomain;
      }

      const normalizedSeoMeta = {
        ...(typeof (seoMetaFromText as any).title === "string"
          ? { title: String((seoMetaFromText as any).title) }
          : {}),
        ...(typeof (seoMetaFromText as any).description === "string"
          ? { description: String((seoMetaFromText as any).description) }
          : {}),
        ...(typeof (seoMetaFromText as any).imageUrl === "string"
          ? { imageUrl: String((seoMetaFromText as any).imageUrl) }
          : {}),
        ...(typeof (seoMetaFromText as any).customDomain === "string"
          ? { customDomain: String((seoMetaFromText as any).customDomain) }
          : {}),
      };

      const res = await apiRequest("PUT", `/api/profiles/${profile.id}`, {
        displayName,
        headline: headline || null,
        contentBlocks: normalizeContentBlocks,
        ctaConfig: normalizedCtaConfig,
        seoMeta: normalizedSeoMeta,
      });
      const updated = (await res.json()) as ProfileDetail;
      setProfile(updated);

      toast({ title: "Saved", description: "Your profile has been updated." });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const publish = async () => {
    if (!profile) return;
    try {
      const res = await apiRequest("PUT", `/api/profiles/${profile.id}/publish`);
      const updated = (await res.json()) as ProfileDetail;
      setProfile(updated);
      toast({
        title: "Published",
        description: "Your profile is now public (if your visibility is public).",
      });
    } catch (error: any) {
      toast({
        title: "Publish failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const unpublish = async () => {
    if (!profile) return;
    try {
      const res = await apiRequest("PUT", `/api/profiles/${profile.id}/unpublish`);
      const updated = (await res.json()) as ProfileDetail;
      setProfile(updated);
      toast({ title: "Unpublished", description: "Your profile is now private (draft)." });
    } catch (error: any) {
      toast({
        title: "Unpublish failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const setVisibility = async (next: "public" | "private") => {
    try {
      const firstRes = await apiRequest("PATCH", "/api/users/profile-visibility", {
        profileVisibility: next,
      });
      const firstPayload = await firstRes.json().catch(() => ({}) as any);

      if (firstPayload?.allowProceedUnverified && next === "public") {
        const proceed = window.confirm(
          "Verification is recommended before publishing. Make profile public now anyway?"
        );
        if (!proceed) {
          toast({ title: "Verification recommended", description: "Visibility not changed." });
          return;
        }

        await apiRequest("PATCH", "/api/users/profile-visibility", {
          profileVisibility: next,
          proceedUnverified: true,
        });
      }

      toast({ title: "Updated", description: `Profile visibility set to ${next}.` });
      setProfileVisibility(next);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const updateProfileSection = async (section: keyof ProfileSections, enabled: boolean) => {
    const previous = profileSections;
    setProfileSections((prev) => ({ ...prev, [section]: enabled }));
    try {
      await apiRequest("PATCH", "/api/users/profile-sections", { [section]: enabled });
    } catch (error: any) {
      setProfileSections(previous);
      toast({
        title: "Section update failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const saveServicesDescription = async () => {
    setSavingPublicSettings(true);
    try {
      await apiRequest("PATCH", "/api/users/preferences", {
        servicesDescription: servicesDescription || "",
      });
      toast({
        title: "Saved",
        description: "Public services description updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setSavingPublicSettings(false);
    }
  };

  const saveUserLocation = async () => {
    setSavingPublicSettings(true);
    try {
      await apiRequest("PUT", "/api/user/profile", {
        address: userLocation.address || null,
        city: userLocation.city || null,
        stateCode: userLocation.stateCode || null,
        zipCode: userLocation.zipCode || null,
        countyFips: userLocation.countyFips || null,
        countyName: userLocation.countyName || null,
      });
      toast({
        title: "Saved",
        description: "User address/location updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setSavingPublicSettings(false);
    }
  };

  const saveBusinessLocation = async () => {
    if (!hasBusinessProfile) return;
    setSavingPublicSettings(true);
    try {
      await apiRequest("PATCH", "/api/business-profile/me", {
        address: businessLocation.address || null,
        city: businessLocation.city || null,
        stateCode: businessLocation.stateCode || null,
        zipCode: businessLocation.zipCode || null,
        countyFips: businessLocation.countyFips || null,
        countyName: businessLocation.countyName || null,
      });
      toast({
        title: "Saved",
        description: "Business address/location updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setSavingPublicSettings(false);
    }
  };

  const patchProfileBooking = (patch: Partial<ProfileBookingSettings>) => {
    setProfileBooking((prev) => ({ ...prev, ...patch }));
  };

  const addBookingSlot = () => {
    patchProfileBooking({
      slots: [
        ...(profileBooking.slots || []),
        {
          id: crypto.randomUUID(),
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
          label: "",
          active: true,
        },
      ],
    });
  };

  const removeBookingSlot = (slotId: string) => {
    patchProfileBooking({
      slots: (profileBooking.slots || []).filter((slot) => slot.id !== slotId),
    });
  };

  const upsertBookingSlot = (slotId: string, patch: Partial<ProfileBookingSlot>) => {
    patchProfileBooking({
      slots: (profileBooking.slots || []).map((slot) =>
        slot.id === slotId ? { ...slot, ...patch } : slot
      ),
    });
  };

  const addPricingRow = () => {
    patchProfileBooking({
      pricingRows: [
        ...(profileBooking.pricingRows || []),
        { id: crypto.randomUUID(), name: "", priceLabel: "", description: "" },
      ],
    });
  };

  const upsertPricingRow = (rowId: string, patch: Partial<ProfilePricingRow>) => {
    patchProfileBooking({
      pricingRows: (profileBooking.pricingRows || []).map((row) =>
        row.id === rowId ? { ...row, ...patch } : row
      ),
    });
  };

  const removePricingRow = (rowId: string) => {
    patchProfileBooking({
      pricingRows: (profileBooking.pricingRows || []).filter((row) => row.id !== rowId),
    });
  };

  const saveProfileBooking = async () => {
    setSavingPublicSettings(true);
    try {
      await apiRequest("PATCH", "/api/users/profile-booking", {
        ...profileBooking,
        slots: (profileBooking.slots || []).filter(
          (slot) =>
            Number.isInteger(slot.dayOfWeek) &&
            slot.dayOfWeek >= 0 &&
            slot.dayOfWeek <= 6 &&
            Boolean(slot.startTime) &&
            Boolean(slot.endTime)
        ),
        pricingRows: (profileBooking.pricingRows || []).filter(
          (row) => row.name?.trim().length && row.priceLabel?.trim().length
        ),
      });
      toast({
        title: "Saved",
        description: "Booking and pricing settings updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setSavingPublicSettings(false);
    }
  };

  const saveColorScheme = async () => {
    setSavingPublicSettings(true);
    try {
      await apiRequest("PATCH", "/api/users/color-scheme", {
        preset: colorPreset,
        ...(colorPreset === "custom" ? customColors : {}),
      });
      toast({
        title: "Saved",
        description: "Public profile color scheme updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setSavingPublicSettings(false);
    }
  };

  if (loading) {
    return (
      <div className=" flex items-center justify-center">
        <div className="ts-surface px-4 py-6 md:px-10 md:py-8 text-white">Loading editor…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className=" flex items-center justify-center px-4">
        <Card className="bg-tsCard border-white/10 w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-white">Profile not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white/70">You may not have access to this profile.</p>
            <Link href="/direct-connect">
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                Go to Direct Connect
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className=" py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card className="bg-tsCard border-white/10">
          <CardHeader className="space-y-1">
            <CardTitle className="text-white">Edit Profile Site</CardTitle>
            <p className="text-white/70 text-sm">Draft until you publish.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Link href={`/u/${profile.slug}`}>
                <Button variant="outline" className="border-white/10 text-white/70">
                  View public page
                </Button>
              </Link>
              <Button onClick={save} className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                Save
              </Button>
              {profile.status === "published" ? (
                <Button
                  onClick={unpublish}
                  variant="outline"
                  className="border-white/10 text-white/70"
                >
                  Unpublish
                </Button>
              ) : (
                <Button
                  onClick={publish}
                  variant="outline"
                  className="border-white/10 text-white/70"
                >
                  Publish
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Headline</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="One-liner"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Content blocks (JSON)</Label>
              <Textarea
                value={contentBlocksText}
                onChange={(e) => setContentBlocksText(e.target.value)}
                rows={10}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">CTA config (JSON)</Label>
              <Textarea
                value={ctaConfigText}
                onChange={(e) => setCtaConfigText(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">SEO meta (JSON)</Label>
              <Textarea
                value={seoMetaText}
                onChange={(e) => setSeoMetaText(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Custom domain (optional)</Label>
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="profile.yourdomain.com"
              />
              <p className="text-white/60 text-xs">
                When configured in DNS, this domain will resolve to this public profile.
              </p>
            </div>

            <div
              className="pt-4 border-t border-white/10 space-y-6"
              data-testid="profile-editor-public-settings"
            >
              <div className="space-y-2">
                <h3 className="text-white font-semibold">Public Profile Settings</h3>
                <p className="text-white/60 text-xs">
                  All public profile controls live here in the edit flow: visibility, section
                  exposure, services text, booking/pricing, and profile colors.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <p className="text-white/70 text-sm">
                  Visibility setting: <span className="text-white">{profileVisibility}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={profileVisibility === "public" ? "default" : "outline"}
                    data-testid="profile-editor-visibility-public"
                    className={
                      profileVisibility === "public"
                        ? "bg-ts-orange hover:bg-ts-orange-dark text-white"
                        : "border-white/10 text-white/70"
                    }
                    onClick={() => setVisibility("public")}
                  >
                    Make link public
                  </Button>
                  <Button
                    variant={profileVisibility === "private" ? "default" : "outline"}
                    data-testid="profile-editor-visibility-private"
                    className={
                      profileVisibility === "private"
                        ? "bg-ts-orange hover:bg-ts-orange-dark text-white"
                        : "border-white/10 text-white/70"
                    }
                    onClick={() => setVisibility("private")}
                  >
                    Make link private
                  </Button>
                </div>
                <p className="text-white/60 text-xs">
                  Profile must be published and set to public for guests to view it.
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-white/10 p-4">
                <Label className="text-white/70">Address separation</Label>
                <p className="text-white/60 text-xs">
                  Keep user/home address and business address separate. This prevents public
                  business profile updates from overwriting your personal account location.
                </p>

                <div className="space-y-3 rounded-md border border-white/10 p-3">
                  <div className="space-y-1">
                    <p className="text-sm text-white font-medium">User address (account/home)</p>
                    <p className="text-xs text-white/60">
                      Used for your account-level local context and personal routing.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs text-white/60">Street address</Label>
                      <Input
                        data-testid="profile-editor-user-address"
                        value={userLocation.address}
                        onChange={(event) =>
                          setUserLocation((prev) => ({ ...prev, address: event.target.value }))
                        }
                        placeholder="123 Main St"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/60">City</Label>
                      <Input
                        data-testid="profile-editor-user-city"
                        value={userLocation.city}
                        onChange={(event) =>
                          setUserLocation((prev) => ({ ...prev, city: event.target.value }))
                        }
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/60">ZIP</Label>
                      <Input
                        data-testid="profile-editor-user-zip"
                        value={userLocation.zipCode}
                        onChange={(event) =>
                          setUserLocation((prev) => ({ ...prev, zipCode: event.target.value }))
                        }
                        placeholder="ZIP"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <StateCountySelector
                        selectedState={userLocation.stateCode}
                        selectedCounty={userLocation.countyFips}
                        stateTestId="profile-editor-user-state"
                        countyTestId="profile-editor-user-county"
                        onStateChange={(stateCode) =>
                          setUserLocation((prev) => ({
                            ...prev,
                            stateCode,
                            countyFips: "",
                            countyName: "",
                          }))
                        }
                        onCountyChange={(countyFips) =>
                          setUserLocation((prev) => ({ ...prev, countyFips }))
                        }
                        onCountySelected={(county: any) =>
                          setUserLocation((prev) => ({
                            ...prev,
                            countyName: county?.name || "",
                          }))
                        }
                        disabled={savingPublicSettings}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      data-testid="profile-editor-user-location-save"
                      onClick={saveUserLocation}
                      disabled={savingPublicSettings}
                      className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                    >
                      Save user address
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-white/10 p-3">
                  <div className="space-y-1">
                    <p className="text-sm text-white font-medium">
                      Business address (public-facing)
                    </p>
                    <p className="text-xs text-white/60">
                      Applies to your business profile only. Kept separate from account/home
                      address.
                    </p>
                  </div>
                  {!hasBusinessProfile ? (
                    <p className="text-xs text-white/60">
                      No published business profile is linked to this account yet.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-xs text-white/60">Street address</Label>
                          <Input
                            data-testid="profile-editor-business-address"
                            value={businessLocation.address || ""}
                            onChange={(event) =>
                              setBusinessLocation((prev) => ({
                                ...prev,
                                address: event.target.value,
                              }))
                            }
                            placeholder="Business street address"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-white/60">City</Label>
                          <Input
                            data-testid="profile-editor-business-city"
                            value={businessLocation.city || ""}
                            onChange={(event) =>
                              setBusinessLocation((prev) => ({
                                ...prev,
                                city: event.target.value,
                              }))
                            }
                            placeholder="City"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-white/60">ZIP</Label>
                          <Input
                            data-testid="profile-editor-business-zip"
                            value={businessLocation.zipCode || ""}
                            onChange={(event) =>
                              setBusinessLocation((prev) => ({
                                ...prev,
                                zipCode: event.target.value,
                              }))
                            }
                            placeholder="ZIP"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <StateCountySelector
                            selectedState={businessLocation.stateCode || ""}
                            selectedCounty={businessLocation.countyFips || ""}
                            stateTestId="profile-editor-business-state"
                            countyTestId="profile-editor-business-county"
                            onStateChange={(stateCode) =>
                              setBusinessLocation((prev) => ({
                                ...prev,
                                stateCode,
                                countyFips: "",
                                countyName: "",
                              }))
                            }
                            onCountyChange={(countyFips) =>
                              setBusinessLocation((prev) => ({ ...prev, countyFips }))
                            }
                            onCountySelected={(county: any) =>
                              setBusinessLocation((prev) => ({
                                ...prev,
                                countyName: county?.name || "",
                              }))
                            }
                            disabled={savingPublicSettings}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          data-testid="profile-editor-business-location-save"
                          onClick={saveBusinessLocation}
                          disabled={savingPublicSettings}
                          className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                        >
                          Save business address
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <Label className="text-white/70">Services description</Label>
                <Textarea
                  data-testid="profile-editor-services-description"
                  value={servicesDescription}
                  onChange={(event) => setServicesDescription(event.target.value)}
                  rows={4}
                  placeholder="What services should be shown on your public profile?"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    data-testid="profile-editor-services-save"
                    onClick={saveServicesDescription}
                    disabled={savingPublicSettings}
                    className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                  >
                    Save services text
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <Label className="text-white/70">Public sections</Label>
                <div className="space-y-3">
                  {PROFILE_SECTION_OPTIONS.map((item) => (
                    <div
                      key={item.key}
                      className="flex flex-col gap-3 rounded-md border border-white/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white">{item.label}</p>
                        <p className="text-xs text-white/60">{item.description}</p>
                      </div>
                      <Switch
                        data-testid={`profile-editor-section-${item.key}`}
                        checked={profileSections[item.key] !== false}
                        disabled={savingPublicSettings}
                        onCheckedChange={(enabled) => {
                          void updateProfileSection(item.key, enabled);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <Label className="text-white/70">Profile color scheme</Label>
                <Select value={colorPreset} onValueChange={setColorPreset}>
                  <SelectTrigger data-testid="profile-editor-color-preset">
                    <SelectValue placeholder="Select color preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {getPresetNames().map((preset) => (
                      <SelectItem key={preset} value={preset}>
                        {preset}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">custom</SelectItem>
                  </SelectContent>
                </Select>
                {colorPreset === "custom" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-white/60">Primary</Label>
                      <Input
                        value={customColors.primary}
                        onChange={(event) =>
                          setCustomColors((prev) => ({ ...prev, primary: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/60">Secondary</Label>
                      <Input
                        value={customColors.secondary}
                        onChange={(event) =>
                          setCustomColors((prev) => ({ ...prev, secondary: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/60">Background</Label>
                      <Input
                        value={customColors.background}
                        onChange={(event) =>
                          setCustomColors((prev) => ({ ...prev, background: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-white/60">Text</Label>
                      <Input
                        value={customColors.text}
                        onChange={(event) =>
                          setCustomColors((prev) => ({ ...prev, text: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    data-testid="profile-editor-color-save"
                    onClick={saveColorScheme}
                    disabled={savingPublicSettings}
                    className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                  >
                    Save color scheme
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-white/10 p-4">
                <Label className="text-white/70">Booking and pricing</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white">Enable booking on profile</p>
                      <Switch
                        data-testid="profile-editor-booking-enabled"
                        checked={profileBooking.enabled === true}
                        onCheckedChange={(enabled) => patchProfileBooking({ enabled })}
                      />
                    </div>
                  </div>
                  <div className="rounded-md border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white">Enable paid bookings</p>
                      <Switch
                        data-testid="profile-editor-booking-paid"
                        checked={profileBooking.paidBookings === true}
                        disabled={profileBooking.enabled !== true}
                        onCheckedChange={(paidBookings) => patchProfileBooking({ paidBookings })}
                      />
                    </div>
                  </div>
                </div>

                {profileBooking.paidBookings === true && (
                  <div className="space-y-1">
                    <Label className="text-white/70">Booking deposit (USD)</Label>
                    <Input
                      type="number"
                      data-testid="profile-editor-booking-deposit"
                      min={0}
                      step="0.01"
                      value={String(profileBooking.bookingPriceUsd ?? 0)}
                      onChange={(event) =>
                        patchProfileBooking({
                          bookingPriceUsd: Math.max(0, Number(event.target.value || 0)),
                        })
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-white/70">Calendar visibility</Label>
                    <Select
                      value={profileBooking.calendarVisibility || "public"}
                      onValueChange={(value) =>
                        patchProfileBooking({ calendarVisibility: value as "public" | "private" })
                      }
                    >
                      <SelectTrigger data-testid="profile-editor-booking-calendar-visibility">
                        <SelectValue placeholder="Calendar visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public availability</SelectItem>
                        <SelectItem value="private">Private availability</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/70">Timezone</Label>
                    <Input
                      data-testid="profile-editor-booking-timezone"
                      value={profileBooking.timezone || "America/Chicago"}
                      onChange={(event) => patchProfileBooking({ timezone: event.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-white/70">Availability slots</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addBookingSlot}
                      data-testid="profile-editor-booking-add-slot"
                    >
                      Add slot
                    </Button>
                  </div>
                  {(profileBooking.slots || []).length === 0 ? (
                    <p className="text-xs text-white/60">No slots yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(profileBooking.slots || []).map((slot) => (
                        <div
                          key={slot.id}
                          className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                          data-testid={`profile-editor-booking-slot-${slot.id}`}
                        >
                          <Select
                            value={String(slot.dayOfWeek)}
                            onValueChange={(value) =>
                              upsertBookingSlot(slot.id, { dayOfWeek: Number(value) })
                            }
                          >
                            <SelectTrigger
                              data-testid={`profile-editor-booking-slot-day-${slot.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day, index) => (
                                <SelectItem key={day} value={String(index)}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="time"
                            data-testid={`profile-editor-booking-slot-start-${slot.id}`}
                            value={slot.startTime}
                            onChange={(event) =>
                              upsertBookingSlot(slot.id, { startTime: event.target.value })
                            }
                          />
                          <Input
                            type="time"
                            data-testid={`profile-editor-booking-slot-end-${slot.id}`}
                            value={slot.endTime}
                            onChange={(event) =>
                              upsertBookingSlot(slot.id, { endTime: event.target.value })
                            }
                          />
                          <Input
                            data-testid={`profile-editor-booking-slot-label-${slot.id}`}
                            value={slot.label || ""}
                            placeholder="Label"
                            onChange={(event) =>
                              upsertBookingSlot(slot.id, { label: event.target.value })
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            data-testid={`profile-editor-booking-slot-remove-${slot.id}`}
                            onClick={() => removeBookingSlot(slot.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded-md border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Label className="text-white/70">Pricing table</Label>
                      <Switch
                        data-testid="profile-editor-pricing-enabled"
                        checked={profileBooking.pricingTableEnabled === true}
                        onCheckedChange={(pricingTableEnabled) =>
                          patchProfileBooking({ pricingTableEnabled })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="profile-editor-pricing-add-row"
                      disabled={profileBooking.pricingTableEnabled !== true}
                      onClick={addPricingRow}
                    >
                      Add row
                    </Button>
                  </div>
                  {profileBooking.pricingTableEnabled === true &&
                    ((profileBooking.pricingRows || []).length === 0 ? (
                      <p className="text-xs text-white/60">No pricing rows yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {(profileBooking.pricingRows || []).map((row) => (
                          <div
                            key={row.id}
                            className="grid grid-cols-1 gap-2 sm:grid-cols-4"
                            data-testid={`profile-editor-pricing-row-${row.id}`}
                          >
                            <Input
                              data-testid={`profile-editor-pricing-name-${row.id}`}
                              value={row.name}
                              placeholder="Service"
                              onChange={(event) =>
                                upsertPricingRow(row.id, { name: event.target.value })
                              }
                            />
                            <Input
                              data-testid={`profile-editor-pricing-price-${row.id}`}
                              value={row.priceLabel}
                              placeholder="$125"
                              onChange={(event) =>
                                upsertPricingRow(row.id, { priceLabel: event.target.value })
                              }
                            />
                            <Input
                              data-testid={`profile-editor-pricing-description-${row.id}`}
                              value={row.description || ""}
                              placeholder="Description"
                              onChange={(event) =>
                                upsertPricingRow(row.id, { description: event.target.value })
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              data-testid={`profile-editor-pricing-remove-${row.id}`}
                              onClick={() => removePricingRow(row.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    data-testid="profile-editor-booking-save"
                    onClick={saveProfileBooking}
                    disabled={savingPublicSettings}
                    className="bg-ts-orange hover:bg-ts-orange-dark text-white"
                  >
                    Save booking and pricing
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
