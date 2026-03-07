import { useState, useEffect, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { uploadObject } from "@/lib/objectUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { COLOR_PRESETS, getPresetNames, type ColorScheme } from "@shared/colorPresets";
import { Palette, Home, Eye, EyeOff, LayoutTemplate, Calendar } from "lucide-react";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

interface UserPreferences {
  defaultHomePage?: string;
  profileVisibility?: "public" | "private";
  colorScheme?: {
    preset?: string;
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
    accent?: string;
    border?: string;
  };
  profileSections?: ProfileSections;
  servicesDescription?: string;
  profileBooking?: ProfileBookingSettings;
}

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

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ProfileSettings() {
  const { user, refetch } = useAuth();
  const { updateCustomColors } = useTheme();
  const [location, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [profileBasics, setProfileBasics] = useState({
    firstName: "",
    lastName: "",
    profileImageUrl: "",
  });

  // Safety valve: if a network request hangs, do not leave the page locked forever.
  useEffect(() => {
    if (!loading) return;
    const watchdog = window.setTimeout(() => setLoading(false), 15000);
    return () => window.clearTimeout(watchdog);
  }, [loading]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultHomePage: "llm",
    profileVisibility: "public",
    colorScheme: { preset: "default" },
    profileSections: {},
    servicesDescription: "",
    profileBooking: {
      enabled: false,
      paidBookings: false,
      bookingPriceUsd: 0,
      calendarVisibility: "public",
      timezone: "America/Chicago",
      slots: [],
      pricingTableEnabled: false,
      pricingRows: [],
    },
  });

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

  // 6-color palette (background + UI surface + white/orange accents) that drives BOTH
  // in-app theme and public profile defaults.
  const [palette, setPalette] = useState<{
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    accentStrong: string;
  }>(() => ({
    background: COLOR_PRESETS.default.background,
    surface: COLOR_PRESETS.default.surface || COLOR_PRESETS.default.background,
    text: COLOR_PRESETS.default.text,
    textMuted: COLOR_PRESETS.default.textMuted || COLOR_PRESETS.default.text,
    accent: COLOR_PRESETS.default.primary,
    accentStrong: COLOR_PRESETS.default.secondary,
  }));

  type PaletteKey = keyof typeof palette;
  const setPaletteField = (key: PaletteKey, value: string) => {
    setPalette((prev) => ({ ...prev, [key]: value }));
  };

  const HEX6_BODY = "[0-9A-Fa-f]{6}";
  const HEX8_BODY = "[0-9A-Fa-f]{8}";
  const HEX6_REGEX = new RegExp("^#" + HEX6_BODY + "$");
  const HEX8_REGEX = new RegExp("^#" + HEX8_BODY + "$");
  const HEX_BLACK_FALLBACK = "#" + "000000";

  const sanitizeColorForInput = (value: string | undefined | null) => {
    if (!value || typeof value !== "string") return HEX_BLACK_FALLBACK;
    // If we get an 8-digit hex (e.g. #rrggbbaa), trim to 6-digit which <input type="color"> expects.
    if (HEX8_REGEX.test(value)) {
      return value.slice(0, 7);
    }
    // If it's already a 6-digit hex, use as-is; otherwise fall back to black.
    return HEX6_REGEX.test(value) ? value : HEX_BLACK_FALLBACK;
  };

  useEffect(() => {
    if (user?.preferences) {
      setPreferences({
        defaultHomePage: user.preferences.defaultHomePage || "llm",
        profileVisibility: user.preferences.profileVisibility || "public",
        colorScheme: user.preferences.colorScheme || { preset: "default" },
        profileSections: user.preferences.profileSections || {},
        servicesDescription: user.preferences.servicesDescription || "",
        profileBooking: user.preferences.profileBooking || {
          enabled: false,
          paidBookings: false,
          bookingPriceUsd: 0,
          calendarVisibility: "public",
          timezone: "America/Chicago",
          slots: [],
          pricingTableEnabled: false,
          pricingRows: [],
        },
      });

      const scheme = user.preferences.colorScheme;
      if (scheme && scheme.preset === "custom") {
        setCustomColors({
          primary: scheme.primary || COLOR_PRESETS.default.primary,
          secondary: scheme.secondary || COLOR_PRESETS.default.secondary,
          background: scheme.background || COLOR_PRESETS.default.background,
          text: scheme.text || COLOR_PRESETS.default.text,
        });
      }

      // Prefer the richer site theme payload when available; otherwise derive from profile scheme.
      try {
        const rawTheme = (user as any)?.customThemeColors
          ? JSON.parse((user as any).customThemeColors)
          : null;
        if (
          rawTheme?.bgPrimary &&
          rawTheme?.bgSecondary &&
          rawTheme?.textPrimary &&
          rawTheme?.accentPrimary &&
          rawTheme?.accentSecondary
        ) {
          setPalette({
            background: sanitizeColorForInput(rawTheme.bgPrimary),
            surface: sanitizeColorForInput(rawTheme.bgSecondary),
            text: sanitizeColorForInput(rawTheme.textPrimary),
            textMuted: sanitizeColorForInput(rawTheme.textSecondary),
            accent: sanitizeColorForInput(rawTheme.accentPrimary),
            accentStrong: sanitizeColorForInput(rawTheme.accentSecondary),
          });
        } else if (scheme) {
          setPalette((prev) => ({
            ...prev,
            background: sanitizeColorForInput(scheme.background || prev.background),
            text: sanitizeColorForInput(scheme.text || prev.text),
            accent: sanitizeColorForInput(scheme.primary || prev.accent),
            accentStrong: sanitizeColorForInput(scheme.secondary || prev.accentStrong),
          }));
        }
      } catch {
        // ignore malformed theme payloads
      }
    }
  }, [user]);

  useEffect(() => {
    setProfileBasics({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      profileImageUrl: user?.profileImageUrl || "",
    });
  }, [user?.firstName, user?.lastName, user?.profileImageUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadProfileSlug = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch("/api/profiles", { credentials: "include" });
        if (!res.ok) return;
        const list = (await res.json()) as Array<{ id: string; slug: string; status?: string }>;
        if (!Array.isArray(list) || list.length === 0) return;

        const activeProfileId = (user as any).activeProfileId as string | undefined;
        let active = activeProfileId ? list.find((p) => p.id === activeProfileId) : undefined;
        if (!active) {
          active = (list.find((p) => (p as any).status === "published") as any) || list[0];
        }

        if (!cancelled) {
          setProfileSlug(active?.slug || null);
        }
      } catch (err) {
        console.error("Error loading profile site slug for public links:", err);
      }
    };

    loadProfileSlug();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Lightweight onboarding hint when redirected after social sign-up
  const isOnboarding = location.includes("onboarding=1");

  const readApiError = async (response: Response): Promise<string> => {
    try {
      const json: any = await response.json();
      if (json?.message) return String(json.message);
      if (json?.code) return String(json.code);
    } catch {
      // ignore
    }

    try {
      const text = await response.text();
      if (text) return text.slice(0, 500);
    } catch {
      // ignore
    }

    return `Request failed (${response.status})`;
  };

  const updateColorScheme = async (preset: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/color-scheme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preset }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = await response.json();
      setPreferences((prev) => ({ ...prev, colorScheme: data.colorScheme }));
      await refetch();

      toast({
        title: "Color scheme updated",
        description: "Your profile colors have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to update color scheme"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCustomColors = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/color-scheme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          preset: "custom",
          primary: customColors.primary,
          secondary: customColors.secondary,
          background: customColors.background,
          text: customColors.text,
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = await response.json();
      setPreferences((prev) => ({ ...prev, colorScheme: data.colorScheme }));
      await refetch();

      toast({
        title: "Color scheme updated",
        description: "Your profile colors have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to update color scheme"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePalette = async () => {
    setLoading(true);

    try {
      // 1) Save as the site's authoritative theme (rich token set)
      updateCustomColors({
        bgPrimary: palette.background,
        bgSecondary: palette.surface,
        // Only 2 layers requested (background + UI), but we still need a chrome value.
        // Derive a slightly deeper surface for nav/chrome.
        bgTertiary: `color-mix(in oklab, ${palette.background} 85%, #000 15%)`,
        textPrimary: palette.text,
        textSecondary: palette.textMuted,
        accentPrimary: palette.accent,
        accentSecondary: palette.accentStrong,
        borderPrimary: `color-mix(in oklab, ${palette.text} 12%, transparent)`,
        borderSecondary: `color-mix(in oklab, ${palette.text} 8%, transparent)`,
      });

      // 2) Keep public profile color scheme aligned (back-compat path used by profile renderer)
      const response = await fetch("/api/users/color-scheme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          preset: "custom",
          primary: palette.accent,
          secondary: palette.accentStrong,
          background: palette.background,
          text: palette.text,
        }),
      });

      if (!response.ok) throw new Error("Failed to update color scheme");

      await refetch();

      toast({
        title: "Palette updated",
        description: "Your site theme and public profile colors are now synced.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update palette",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { publicUrl } = await uploadObject(file);
      setProfileBasics((prev) => ({ ...prev, profileImageUrl: publicUrl }));
      toast({
        title: "Photo uploaded",
        description: "Click Save profile to apply your new photo.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(error, "Could not upload photo"),
        variant: "destructive",
      });
    } finally {
      e.currentTarget.value = "";
    }
  };

  const saveProfileBasics = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: profileBasics.firstName,
          lastName: profileBasics.lastName,
          profileImageUrl: profileBasics.profileImageUrl,
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));
      await refetch();
      toast({
        title: "Profile updated",
        description: "Your profile photo and name were saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to update profile"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDefaultHome = async (page: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/default-home", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ defaultHomePage: page }),
      });

      if (!response.ok) throw new Error("Failed to update home page");

      setPreferences((prev) => ({ ...prev, defaultHomePage: page }));
      await refetch();

      toast({
        title: "Default home page updated",
        description: `Your home page is now set to ${page}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update home page",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfileVisibility = async (isPublic: boolean) => {
    setLoading(true);
    const visibility = isPublic ? "public" : "private";

    try {
      const requestVisibility = async (proceed = false) => {
        const response = await fetch("/api/users/profile-visibility", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            profileVisibility: visibility,
            ...(proceed ? { proceedUnverified: true } : {}),
          }),
        });

        const payload = await response.json().catch(() => ({}));
        return { response, payload };
      };

      const { response, payload } = await requestVisibility(false);

      if (!response.ok)
        throw new Error((payload as any)?.message || `Request failed (${response.status})`);

      if (payload?.allowProceedUnverified && visibility === "public") {
        const proceed = window.confirm(
          "Verification is recommended before publishing. Publish publicly now anyway?"
        );
        if (!proceed) {
          toast({
            title: "Verification recommended",
            description: "Profile visibility was not changed.",
          });
          return;
        }

        const retry = await requestVisibility(true);
        if (!retry.response.ok) {
          throw new Error(
            (retry.payload as any)?.message || `Request failed (${retry.response.status})`
          );
        }
      }

      setPreferences((prev) => ({ ...prev, profileVisibility: visibility }));
      await refetch();

      toast({
        title: "Profile visibility updated",
        description: `Your profile is now ${visibility}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to update visibility"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveServicesDescription = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          servicesDescription: preferences.servicesDescription || "",
        }),
      });

      if (!response.ok) throw new Error("Failed to update services description");

      const data = await response.json();
      setPreferences((prev) => ({
        ...prev,
        servicesDescription: data.preferences?.servicesDescription || "",
      }));
      await refetch();

      toast({
        title: "Services updated",
        description: "Scout and routing will now use your service description when making matches.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update services description",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfileSection = async (section: keyof ProfileSections, enabled: boolean) => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/profile-sections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [section]: enabled }),
      });

      if (!response.ok) throw new Error("Failed to update profile sections");

      const data = await response.json();

      setPreferences((prev) => ({
        ...prev,
        profileSections: {
          ...(prev.profileSections || {}),
          ...(data.preferences?.profileSections || {}),
          [section]: enabled,
        },
      }));

      await refetch();

      toast({
        title: "Profile site updated",
        description: "Your public profile layout has been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile site sections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const profileBooking = preferences.profileBooking || {
    enabled: false,
    paidBookings: false,
    bookingPriceUsd: 0,
    calendarVisibility: "public" as const,
    timezone: "America/Chicago",
    slots: [],
    pricingTableEnabled: false,
    pricingRows: [],
  };

  const updateProfileBooking = (patch: Partial<ProfileBookingSettings>) => {
    setPreferences((prev) => ({
      ...prev,
      profileBooking: {
        ...(prev.profileBooking || {}),
        ...patch,
      },
    }));
  };

  const upsertBookingSlot = (slotId: string, patch: Partial<ProfileBookingSlot>) => {
    const nextSlots = (profileBooking.slots || []).map((slot) =>
      slot.id === slotId ? { ...slot, ...patch } : slot
    );
    updateProfileBooking({ slots: nextSlots });
  };

  const addBookingSlot = () => {
    const nextSlots = [
      ...(profileBooking.slots || []),
      {
        id: crypto.randomUUID(),
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
        label: "",
        active: true,
      },
    ];
    updateProfileBooking({ slots: nextSlots });
  };

  const removeBookingSlot = (slotId: string) => {
    updateProfileBooking({
      slots: (profileBooking.slots || []).filter((slot) => slot.id !== slotId),
    });
  };

  const upsertPricingRow = (rowId: string, patch: Partial<ProfilePricingRow>) => {
    const nextRows = (profileBooking.pricingRows || []).map((row) =>
      row.id === rowId ? { ...row, ...patch } : row
    );
    updateProfileBooking({ pricingRows: nextRows });
  };

  const addPricingRow = () => {
    const nextRows = [
      ...(profileBooking.pricingRows || []),
      {
        id: crypto.randomUUID(),
        name: "",
        priceLabel: "",
        description: "",
      },
    ];
    updateProfileBooking({ pricingRows: nextRows });
  };

  const removePricingRow = (rowId: string) => {
    updateProfileBooking({
      pricingRows: (profileBooking.pricingRows || []).filter((row) => row.id !== rowId),
    });
  };

  const saveProfileBooking = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/profile-booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...profileBooking,
          slots: (profileBooking.slots || []).filter(
            (slot) => slot.startTime && slot.endTime && Number.isInteger(slot.dayOfWeek)
          ),
          pricingRows: (profileBooking.pricingRows || []).filter(
            (row) => row.name?.trim().length && row.priceLabel?.trim().length
          ),
        }),
      });

      if (!response.ok) throw new Error("Failed to update booking settings");
      const data = await response.json();

      setPreferences((prev) => ({
        ...prev,
        profileBooking: data.profileBooking || prev.profileBooking,
      }));
      await refetch();

      toast({
        title: "Booking settings saved",
        description: "Public booking, calendar, and pricing preferences are updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save booking settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const currentPreset = preferences.colorScheme?.preset || "default";
  const previewColors: ColorScheme =
    currentPreset === "custom"
      ? {
          primary: preferences.colorScheme?.primary || COLOR_PRESETS.default.primary,
          secondary: preferences.colorScheme?.secondary || COLOR_PRESETS.default.secondary,
          background: preferences.colorScheme?.background || COLOR_PRESETS.default.background,
          text: preferences.colorScheme?.text || COLOR_PRESETS.default.text,
          accent:
            preferences.colorScheme?.accent ||
            preferences.colorScheme?.primary ||
            COLOR_PRESETS.default.primary,
          border:
            preferences.colorScheme?.border ||
            preferences.colorScheme?.background ||
            COLOR_PRESETS.default.background,
        }
      : COLOR_PRESETS[currentPreset] || COLOR_PRESETS.default;

  const handlePresetChange = (preset: string) => {
    if (preset === "custom") {
      setPreferences((prev) => ({
        ...prev,
        colorScheme: {
          ...(prev.colorScheme || {}),
          preset: "custom",
          primary: customColors.primary,
          secondary: customColors.secondary,
          background: customColors.background,
          text: customColors.text,
        },
      }));
      return;
    }

    updateColorScheme(preset);
  };

  const profileSectionOptions: Array<{
    key: keyof ProfileSections;
    label: string;
    description: string;
  }> = [
    {
      key: "about",
      label: "About",
      description: "High-level overview of who you are on TradeScout.",
    },
    {
      key: "rolesAndBadges",
      label: "Roles and badges",
      description: "Show your TradeScout roles and earned badges.",
    },
    {
      key: "stats",
      label: "Stats",
      description: "Show activity and trust metrics when available.",
    },
    {
      key: "services",
      label: "Services",
      description: "Show the services summary from your profile.",
    },
    {
      key: "marketplaceListings",
      label: "Marketplace listings",
      description: "Feature active marketplace listings on your public profile.",
    },
    {
      key: "reviews",
      label: "Recommendations",
      description: "Display CVS trust and recommendation sections.",
    },
    {
      key: "communityActivity",
      label: "Community activity",
      description: "Show your visible participation in TradeScout communities.",
    },
    {
      key: "contactCard",
      label: "Contact card",
      description: "Show a call-to-action for routed contact requests.",
    },
  ];

  const paletteFields: Array<{ key: PaletteKey; label: string; value: string }> = [
    { key: "background", label: "Background", value: palette.background },
    { key: "surface", label: "Surface", value: palette.surface },
    { key: "text", label: "Text", value: palette.text },
    { key: "textMuted", label: "Muted text", value: palette.textMuted },
    { key: "accent", label: "Accent", value: palette.accent },
    { key: "accentStrong", label: "Accent strong", value: palette.accentStrong },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-20 pt-6">
      <Card className="border-white/10 bg-tsCard">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">Profile Settings</h1>
              <p className="mt-2 text-sm text-white/70 md:text-base">
                Control identity, routing, visibility, booking, and appearance from one place.
              </p>
              {isOnboarding && (
                <p className="mt-2 text-xs text-white/60 md:text-sm">
                  You just created your account with Google or Facebook. Finish setup now or come
                  back later from Settings to complete it.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                Visibility:{" "}
                {preferences.profileVisibility === "public" ? "Public profile" : "Private profile"}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                Home: {preferences.defaultHomePage || "llm"}
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                Booking: {profileBooking.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="identity" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-4">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="booking">Booking</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-6">
          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle>Profile Basics</CardTitle>
              <CardDescription>Update your profile photo and display name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-white/10 text-sm font-semibold flex items-center justify-center">
                  {profileBasics.profileImageUrl ? (
                    <img
                      src={profileBasics.profileImageUrl}
                      alt="Profile"
                      className="h-16 w-16 object-cover"
                    />
                  ) : (
                    <span>
                      {(profileBasics.firstName?.[0] || user?.firstName?.[0] || "").toUpperCase()}
                      {(profileBasics.lastName?.[0] || user?.lastName?.[0] || "").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Label htmlFor="profile-photo-upload">Profile photo</Label>
                  <div className="mt-1">
                    <Input
                      id="profile-photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoSelected}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>First name</Label>
                  <Input
                    value={profileBasics.firstName}
                    onChange={(e) =>
                      setProfileBasics((prev) => ({ ...prev, firstName: e.target.value }))
                    }
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Last name</Label>
                  <Input
                    value={profileBasics.lastName}
                    onChange={(e) =>
                      setProfileBasics((prev) => ({ ...prev, lastName: e.target.value }))
                    }
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={saveProfileBasics} disabled={loading}>
                  {loading ? "Saving..." : "Save profile basics"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-ts-orange" />
                Public pages
              </CardTitle>
              <CardDescription>
                Share your public pages. Contact still routes through TradeScout gates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Profile page</div>
                  <div className="break-all text-xs text-white/60">
                    {profileSlug
                      ? `${getCanonicalAppOrigin()}/u/${profileSlug}`
                      : "Not published yet"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!profileSlug}
                    onClick={() => profileSlug && navigate(`/u/${profileSlug}`)}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!profileSlug}
                    onClick={() => profileSlug && navigate(`/u/${profileSlug}/edit`)}
                  >
                    Edit
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Business page</div>
                  <div className="break-all text-xs text-white/60">
                    {(user as any)?.businessSlug
                      ? `${window.location.origin}/business/${(user as any).businessSlug}`
                      : "Not published yet"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!(user as any)?.businessSlug}
                    onClick={() =>
                      (user as any)?.businessSlug &&
                      navigate(`/business/${encodeURIComponent((user as any).businessSlug)}`)
                    }
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!(user as any)?.businessSlug}
                    onClick={() =>
                      (user as any)?.businessSlug &&
                      navigate(`/business/${encodeURIComponent((user as any).businessSlug)}/edit`)
                    }
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {preferences.profileVisibility === "public" ? (
                  <Eye className="h-5 w-5 text-ts-orange" />
                ) : (
                  <EyeOff className="h-5 w-5 text-ts-orange" />
                )}
                Profile visibility
              </CardTitle>
              <CardDescription>
                Choose whether your profile can be discovered by users and Scout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label>Make profile public</Label>
                  <p className="text-sm text-white/60">
                    Allow your profile to appear in search and assistant responses.
                  </p>
                </div>
                <Switch
                  checked={preferences.profileVisibility === "public"}
                  onCheckedChange={updateProfileVisibility}
                  disabled={loading}
                />
              </div>

              {preferences.profileVisibility === "public" && (
                <div className="rounded-lg border border-ts-orange/20 bg-ts-orange/10 p-4 text-sm text-white">
                  Your profile is your website. Public mode surfaces your profile in discovery flows
                  while keeping contact gated through TradeScout rules.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-ts-orange" />
                Default home page
              </CardTitle>
              <CardDescription>Pick the first workspace you see after login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Landing page</Label>
                <Select
                  value={preferences.defaultHomePage || "llm"}
                  onValueChange={updateDefaultHome}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose your landing page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llm">Scout (Default)</SelectItem>
                    <SelectItem value="dashboard">My Dashboard</SelectItem>
                    <SelectItem value="marketplace">Exchange</SelectItem>
                    <SelectItem value="contractor-board">Contractor Board</SelectItem>
                    <SelectItem value="profile">My Profile</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-white/60">
                Current default: {preferences.defaultHomePage || "llm"}.
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-ts-orange" />
                Services you offer
              </CardTitle>
              <CardDescription>
                Scout and routing use this text with your roles and location to avoid mismatches.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={preferences.servicesDescription || ""}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    servicesDescription: e.target.value,
                  }))
                }
                rows={6}
                placeholder="Example: I specialize in small residential plumbing repairs, water heater replacements, and leak detection."
              />
              <div className="flex justify-end">
                <Button type="button" onClick={saveServicesDescription} disabled={loading}>
                  Save services
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-ts-orange" />
                Public profile sections
              </CardTitle>
              <CardDescription>
                Toggle which sections are visible on your public profile site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileSectionOptions.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label>{item.label}</Label>
                    <p className="text-sm text-white/60">{item.description}</p>
                  </div>
                  <Switch
                    checked={preferences.profileSections?.[item.key] !== false}
                    onCheckedChange={(value) => updateProfileSection(item.key, value)}
                    disabled={loading}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-ts-orange" />
                Site and profile palette
              </CardTitle>
              <CardDescription>
                These six colors drive app surfaces and keep your public profile synchronized.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {paletteFields.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <Label className="text-xs">{item.label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={sanitizeColorForInput(item.value)}
                        onChange={(e) => setPaletteField(item.key, e.target.value)}
                        className="h-10 w-10 rounded border border-white/10 bg-transparent p-0"
                      />
                      <Input
                        value={item.value}
                        onChange={(e) => setPaletteField(item.key, e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t border-white/10 pt-2">
                <Button type="button" onClick={savePalette} disabled={loading}>
                  {loading ? "Saving..." : "Save palette"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-ts-orange" />
                Presets and custom colors
              </CardTitle>
              <CardDescription>
                Choose a preset or maintain your own custom color set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select preset</Label>
                  {preferences.colorScheme?.preset &&
                    preferences.colorScheme.preset !== "default" && (
                      <button
                        type="button"
                        onClick={() => handlePresetChange("default")}
                        disabled={loading}
                        className="text-xs text-ts-orange underline underline-offset-2 transition-colors disabled:opacity-50"
                      >
                        Reset to default
                      </button>
                    )}
                </div>
                <Select
                  value={preferences.colorScheme?.preset || "default"}
                  onValueChange={handlePresetChange}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a color scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {getPresetNames().map((preset: string) => (
                      <SelectItem key={preset} value={preset}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 w-4 rounded border"
                            style={{ backgroundColor: COLOR_PRESETS[preset].primary }}
                          />
                          <span className="capitalize">{preset}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded border"
                          style={{ backgroundColor: customColors.primary }}
                        />
                        <span>Custom</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.primary }}
                  />
                  <p className="text-center text-xs text-white/60">Primary</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.secondary }}
                  />
                  <p className="text-center text-xs text-white/60">Secondary</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.background }}
                  />
                  <p className="text-center text-xs text-white/60">Background</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.text }}
                  />
                  <p className="text-center text-xs text-white/60">Text</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Custom colors</Label>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Primary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={sanitizeColorForInput(customColors.primary)}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, primary: e.target.value }))
                        }
                        className="h-10 w-10 rounded border border-white/10 bg-transparent p-0"
                      />
                      <Input
                        value={customColors.primary}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, primary: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Secondary</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={sanitizeColorForInput(customColors.secondary)}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, secondary: e.target.value }))
                        }
                        className="h-10 w-10 rounded border border-white/10 bg-transparent p-0"
                      />
                      <Input
                        value={customColors.secondary}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, secondary: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={sanitizeColorForInput(customColors.background)}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, background: e.target.value }))
                        }
                        className="h-10 w-10 rounded border border-white/10 bg-transparent p-0"
                      />
                      <Input
                        value={customColors.background}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, background: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Text</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={sanitizeColorForInput(customColors.text)}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, text: e.target.value }))
                        }
                        className="h-10 w-10 rounded border border-white/10 bg-transparent p-0"
                      />
                      <Input
                        value={customColors.text}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, text: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={saveCustomColors} disabled={loading}>
                    {loading ? "Saving..." : "Save custom colors"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking" className="space-y-6">
          <Card className="border-white/10 bg-tsCard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-ts-orange" />
                Booking, calendar, and pricing
              </CardTitle>
              <CardDescription>
                Configure bookings, deposits, availability, and pricing rows for your public
                profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable booking on public profile</Label>
                  <p className="text-sm text-white/60">
                    Show booking controls to visitors on your public page.
                  </p>
                </div>
                <Switch
                  checked={profileBooking.enabled === true}
                  onCheckedChange={(value) => updateProfileBooking({ enabled: value })}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable paid bookings</Label>
                  <p className="text-sm text-white/60">
                    Require a Stripe deposit before confirmation.
                  </p>
                </div>
                <Switch
                  checked={profileBooking.paidBookings === true}
                  onCheckedChange={(value) => updateProfileBooking({ paidBookings: value })}
                  disabled={loading || profileBooking.enabled !== true}
                />
              </div>

              {profileBooking.paidBookings === true && (
                <div className="space-y-2">
                  <Label>Booking deposit (USD)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={String(profileBooking.bookingPriceUsd ?? 0)}
                    onChange={(e) =>
                      updateProfileBooking({
                        bookingPriceUsd: Math.max(0, Number(e.target.value || 0)),
                      })
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Calendar visibility</Label>
                <Select
                  value={profileBooking.calendarVisibility || "public"}
                  onValueChange={(value) =>
                    updateProfileBooking({ calendarVisibility: value as "public" | "private" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose calendar visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (show availability)</SelectItem>
                    <SelectItem value="private">Private (hide availability)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Calendar timezone</Label>
                <Input
                  value={profileBooking.timezone || "America/Chicago"}
                  onChange={(e) => updateProfileBooking({ timezone: e.target.value })}
                  placeholder="America/Chicago"
                />
              </div>

              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <Label>Weekly availability slots</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addBookingSlot}
                    disabled={loading}
                  >
                    Add slot
                  </Button>
                </div>
                {(profileBooking.slots || []).length === 0 ? (
                  <p className="text-sm text-white/60">
                    No slots yet. Add at least one availability window.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(profileBooking.slots || []).map((slot) => (
                      <div key={slot.id} className="grid items-end gap-2 md:grid-cols-5">
                        <div className="space-y-1">
                          <Label className="text-xs">Day</Label>
                          <Select
                            value={String(slot.dayOfWeek)}
                            onValueChange={(value) =>
                              upsertBookingSlot(slot.id, { dayOfWeek: Number(value) })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day, idx) => (
                                <SelectItem key={day} value={String(idx)}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Start</Label>
                          <Input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) =>
                              upsertBookingSlot(slot.id, { startTime: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">End</Label>
                          <Input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) =>
                              upsertBookingSlot(slot.id, { endTime: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Label (optional)</Label>
                          <Input
                            value={slot.label || ""}
                            onChange={(e) => upsertBookingSlot(slot.id, { label: e.target.value })}
                            placeholder="Morning"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeBookingSlot(slot.id)}
                          disabled={loading}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show pricing table</Label>
                  <p className="text-sm text-white/60">
                    Publish a simple price list on your public profile.
                  </p>
                </div>
                <Switch
                  checked={profileBooking.pricingTableEnabled === true}
                  onCheckedChange={(value) => updateProfileBooking({ pricingTableEnabled: value })}
                  disabled={loading}
                />
              </div>

              {profileBooking.pricingTableEnabled === true && (
                <div className="space-y-3 rounded-lg border border-white/10 p-4">
                  <div className="flex items-center justify-between">
                    <Label>Pricing rows</Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addPricingRow}
                      disabled={loading}
                    >
                      Add row
                    </Button>
                  </div>
                  {(profileBooking.pricingRows || []).length === 0 ? (
                    <p className="text-sm text-white/60">No pricing rows yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {(profileBooking.pricingRows || []).map((row) => (
                        <div key={row.id} className="grid items-end gap-2 md:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Service</Label>
                            <Input
                              value={row.name}
                              onChange={(e) => upsertPricingRow(row.id, { name: e.target.value })}
                              placeholder="General service"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Price</Label>
                            <Input
                              value={row.priceLabel}
                              onChange={(e) =>
                                upsertPricingRow(row.id, { priceLabel: e.target.value })
                              }
                              placeholder="$125"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Description</Label>
                            <Input
                              value={row.description || ""}
                              onChange={(e) =>
                                upsertPricingRow(row.id, { description: e.target.value })
                              }
                              placeholder="Up to 30 minutes"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removePricingRow(row.id)}
                            disabled={loading}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" onClick={saveProfileBooking} disabled={loading}>
                  Save booking setup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
