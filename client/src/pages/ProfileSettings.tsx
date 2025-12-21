import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { COLOR_PRESETS, getPresetNames, type ColorScheme } from "@shared/colorPresets";
import { Palette, Home, Eye, EyeOff, LayoutTemplate } from "lucide-react";
import { applyTheme, type Theme } from "@/lib/themes";

interface UserPreferences {
  defaultHomePage?: string;
  profileVisibility?: 'public' | 'private';
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
}

export default function ProfileSettings() {
  const { user, refetch } = useAuth();
  const { updateCustomColors } = useTheme();
  const [location, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultHomePage: 'llm',
    profileVisibility: 'public',
    colorScheme: { preset: 'default' },
    profileSections: {},
    servicesDescription: '',
  });

  const [customColors, setCustomColors] = useState<{ primary: string; secondary: string; background: string; text: string }>(
    {
      primary: COLOR_PRESETS.default.primary,
      secondary: COLOR_PRESETS.default.secondary,
      background: COLOR_PRESETS.default.background,
      text: COLOR_PRESETS.default.text,
    }
  );

  const sanitizeColorForInput = (value: string | undefined | null) => {
    if (!value || typeof value !== 'string') return '#000000';
    // If we get an 8-digit hex (e.g. #rrggbbaa), trim to 6-digit which <input type="color"> expects.
    if (/^#[0-9A-Fa-f]{8}$/.test(value)) {
      return value.slice(0, 7);
    }
    // If it's already a 6-digit hex, use as-is; otherwise fall back to black.
    return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000';
  };

  useEffect(() => {
    if (user?.preferences) {
      setPreferences({
        defaultHomePage: user.preferences.defaultHomePage || 'llm',
        profileVisibility: user.preferences.profileVisibility || 'public',
        colorScheme: user.preferences.colorScheme || { preset: 'default' },
        profileSections: user.preferences.profileSections || {},
        servicesDescription: user.preferences.servicesDescription || '',
      });

      const scheme = user.preferences.colorScheme;
      if (scheme && scheme.preset === 'custom') {
        setCustomColors({
          primary: scheme.primary || COLOR_PRESETS.default.primary,
          secondary: scheme.secondary || COLOR_PRESETS.default.secondary,
          background: scheme.background || COLOR_PRESETS.default.background,
          text: scheme.text || COLOR_PRESETS.default.text,
        });
      }
    }
  }, [user]);

  // Lightweight onboarding hint when redirected after social sign-up
  const isOnboarding = location.includes("onboarding=1");

  const updateColorScheme = async (preset: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/color-scheme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preset }),
      });

      if (!response.ok) throw new Error('Failed to update color scheme');

      const data = await response.json();
      setPreferences(prev => ({ ...prev, colorScheme: data.colorScheme }));
      await refetch();
      
      toast({
        title: "Color scheme updated",
        description: "Your profile colors have been saved.",
      });

      // Apply colors to current page
      applyColorScheme(preset);
      applyThemeFromScheme(preset);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update color scheme",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCustomColors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/color-scheme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          preset: 'custom',
          primary: customColors.primary,
          secondary: customColors.secondary,
          background: customColors.background,
          text: customColors.text,
        }),
      });

      if (!response.ok) throw new Error('Failed to update color scheme');

      const data = await response.json();
      setPreferences(prev => ({ ...prev, colorScheme: data.colorScheme }));
      await refetch();
      
      toast({
        title: "Color scheme updated",
        description: "Your profile colors have been saved.",
      });

      if (data.colorScheme?.primary && data.colorScheme?.secondary && data.colorScheme?.background && data.colorScheme?.text) {
        applyCustomColors({
          primary: data.colorScheme.primary,
          secondary: data.colorScheme.secondary,
          background: data.colorScheme.background,
          text: data.colorScheme.text,
          accent: data.colorScheme.accent,
          border: data.colorScheme.border,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update color scheme",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDefaultHome = async (page: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/default-home', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ defaultHomePage: page }),
      });

      if (!response.ok) throw new Error('Failed to update home page');

      setPreferences(prev => ({ ...prev, defaultHomePage: page }));
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
    const visibility = isPublic ? 'public' : 'private';
    
    try {
      const response = await fetch('/api/users/profile-visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profileVisibility: visibility }),
      });

      if (!response.ok) throw new Error('Failed to update visibility');

      setPreferences(prev => ({ ...prev, profileVisibility: visibility }));
      await refetch();
      
      toast({
        title: "Profile visibility updated",
        description: `Your profile is now ${visibility}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update visibility",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveServicesDescription = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          servicesDescription: preferences.servicesDescription || '',
        }),
      });

      if (!response.ok) throw new Error('Failed to update services description');

      const data = await response.json();
      setPreferences(prev => ({
        ...prev,
        servicesDescription: data.preferences?.servicesDescription || '',
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

  const applyColorValues = (colors: ColorScheme) => {
    const root = document.documentElement;
    
    root.style.setProperty('--user-primary', colors.primary);
    root.style.setProperty('--user-secondary', colors.secondary);
    root.style.setProperty('--user-background', colors.background);
    root.style.setProperty('--user-text', colors.text);
    root.style.setProperty('--user-accent', colors.accent || colors.primary);
    root.style.setProperty('--user-border', colors.border || colors.background);
  };

  const applyColorScheme = (preset: string) => {
    const colors = COLOR_PRESETS[preset] || COLOR_PRESETS.default;
    applyColorValues(colors);
  };

  const applyCustomColors = (colors: ColorScheme) => {
    applyColorValues(colors);
    const themeFromScheme: Theme = {
      id: 'profile-custom',
      name: 'Profile Color Scheme',
      description: 'Synced from profile settings',
      colors: {
        bgPrimary: colors.background,
        bgSecondary: colors.background,
        bgTertiary: colors.secondary || colors.background,
        textPrimary: colors.text,
        textSecondary: colors.text,
        accentPrimary: colors.primary,
        accentSecondary: colors.secondary || colors.primary,
        border: colors.border || colors.background,
      },
    };

    applyTheme(themeFromScheme);
    // Keep global theme context in sync so the rest of the app
    // immediately reflects these custom colors.
    updateCustomColors(themeFromScheme.colors);
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeId', themeFromScheme.id);
      localStorage.setItem('customColors', JSON.stringify(themeFromScheme.colors));
    }
  };

  const applyThemeFromScheme = (preset: string) => {
    const colors = COLOR_PRESETS[preset] || COLOR_PRESETS.default;
    const themeFromScheme: Theme = {
      id: `profile-${preset}`,
      name: 'Profile Color Scheme',
      description: 'Synced from profile settings',
      colors: {
        bgPrimary: colors.background,
        bgSecondary: colors.background,
        bgTertiary: colors.secondary || colors.background,
        textPrimary: colors.text,
        textSecondary: colors.text,
        accentPrimary: colors.primary,
        accentSecondary: colors.secondary || colors.primary,
        border: colors.border || colors.background,
      },
    };

    applyTheme(themeFromScheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeId', themeFromScheme.id);
      localStorage.setItem('customColors', JSON.stringify(themeFromScheme.colors));
    }
  };

  // Apply color scheme on mount
  useEffect(() => {
    const scheme = preferences.colorScheme;
    if (!scheme) return;

    if (scheme.preset === 'custom' && scheme.primary && scheme.secondary && scheme.background && scheme.text) {
      applyCustomColors({
        primary: scheme.primary,
        secondary: scheme.secondary,
        background: scheme.background,
        text: scheme.text,
        accent: scheme.accent,
        border: scheme.border,
      });
    } else if (scheme.preset) {
      applyColorScheme(scheme.preset);
      applyThemeFromScheme(scheme.preset);
    }
  }, [preferences.colorScheme]);

  const updateProfileSection = async (section: keyof ProfileSections, enabled: boolean) => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/profile-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [section]: enabled }),
      });

      if (!response.ok) throw new Error('Failed to update profile sections');

      const data = await response.json();

      setPreferences(prev => ({
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

  const currentPreset = preferences.colorScheme?.preset || 'default';
  const previewColors: ColorScheme = currentPreset === 'custom'
    ? {
        primary: preferences.colorScheme?.primary || COLOR_PRESETS.default.primary,
        secondary: preferences.colorScheme?.secondary || COLOR_PRESETS.default.secondary,
        background: preferences.colorScheme?.background || COLOR_PRESETS.default.background,
        text: preferences.colorScheme?.text || COLOR_PRESETS.default.text,
        accent: preferences.colorScheme?.accent || preferences.colorScheme?.primary || COLOR_PRESETS.default.primary,
        border: preferences.colorScheme?.border || preferences.colorScheme?.background || COLOR_PRESETS.default.background,
      }
    : (COLOR_PRESETS[currentPreset] || COLOR_PRESETS.default);

  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setPreferences(prev => ({
        ...prev,
        colorScheme: {
          ...(prev.colorScheme || {}),
          preset: 'custom',
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

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-tsTextMain mb-2">Profile Settings</h1>
        <p className="text-tsTextMuted">
          Customize your TradeScout experience. Your profile is your website.
        </p>
        {isOnboarding && (
          <p className="mt-2 text-sm text-tsTextMuted">
            You just created your account with Google or Facebook. You can finish this now or skip and come back later from Settings → Profile.
          </p>
        )}
      </div>

      {/* Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-tsAccent" />
            Color Scheme
          </CardTitle>
          <CardDescription>
            Choose colors that represent your brand. Visitors to your profile will see these colors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Preset</Label>
            <Select
              value={preferences.colorScheme?.preset || 'default'}
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
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: COLOR_PRESETS[preset].primary }}
                      />
                      <span className="capitalize">{preset}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: customColors.primary }}
                    />
                    <span>Custom</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color Preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {previewColors && (
              <>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.primary }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Primary</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.secondary }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Secondary</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.background }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Background</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: previewColors.text }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Text</p>
                </div>
              </>
            )}
          </div>

          {/* Custom color pickers */}
          <div className="mt-6 space-y-3">
            <Label>Custom Colors</Label>
            <p className="text-xs text-tsTextMuted">
              Pick your own colors for this profile. Select “Custom” above to use them in your theme and public profile.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Primary</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={sanitizeColorForInput(customColors.primary)}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, primary: e.target.value }))}
                    className="w-10 h-10 rounded border border-tsBorder bg-transparent p-0"
                  />
                  <Input
                    value={customColors.primary}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, primary: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Secondary</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={sanitizeColorForInput(customColors.secondary)}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, secondary: e.target.value }))}
                    className="w-10 h-10 rounded border border-tsBorder bg-transparent p-0"
                  />
                  <Input
                    value={customColors.secondary}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, secondary: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={sanitizeColorForInput(customColors.background)}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, background: e.target.value }))}
                    className="w-10 h-10 rounded border border-tsBorder bg-transparent p-0"
                  />
                  <Input
                    value={customColors.background}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, background: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Text</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={sanitizeColorForInput(customColors.text)}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, text: e.target.value }))}
                    className="w-10 h-10 rounded border border-tsBorder bg-transparent p-0"
                  />
                  <Input
                    value={customColors.text}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, text: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveCustomColors} disabled={loading}>
                {loading ? 'Saving…' : 'Save Custom Colors'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Home Page */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-tsAccent" />
            Default Home Page
          </CardTitle>
          <CardDescription>
            Choose the first page you see when you visit TradeScout. Scout and your home route will use this when you open the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Landing Page</Label>
            <Select
              value={preferences.defaultHomePage || 'llm'}
              onValueChange={updateDefaultHome}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose your landing page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llm">Scout (Default)</SelectItem>
                <SelectItem value="dashboard">My Dashboard</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
                <SelectItem value="contractor-board">Contractor Board</SelectItem>
                <SelectItem value="profile">My Profile</SelectItem>
                <SelectItem value="community">Community</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-tsTextMuted">
            Your current default is {preferences.defaultHomePage === 'dashboard' ? 'Dashboard' :
              preferences.defaultHomePage === 'marketplace' ? 'Marketplace' :
              preferences.defaultHomePage === 'contractor-board' ? 'Contractor Board' :
              preferences.defaultHomePage === 'profile' ? 'My Profile' :
              preferences.defaultHomePage === 'community' ? 'Community Feed' :
              'Scout (Default)'}.
          </p>
        </CardContent>
      </Card>

      {/* Profile Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {preferences.profileVisibility === 'public' ? (
              <Eye className="h-5 w-5 text-tsAccent" />
            ) : (
              <EyeOff className="h-5 w-5 text-tsAccent" />
            )}
            Profile Visibility
          </CardTitle>
          <CardDescription>
            Control who can see your profile. Public profiles are searchable and can be found by Scout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Make Profile Public</Label>
              <p className="text-sm text-tsTextMuted">
                Allow your profile to be found in searches and by the AI
              </p>
            </div>
            <Switch
              checked={preferences.profileVisibility === 'public'}
              onCheckedChange={updateProfileVisibility}
              disabled={loading}
            />
          </div>
          
          {preferences.profileVisibility === 'public' && (
            <div className="p-4 bg-tsAccent/10 rounded-lg border border-tsAccent/20">
              <p className="text-sm text-tsTextMain">
                <strong>Your profile is your website.</strong> When public, visitors will see your customized colors,
                user types, activity, and information. Scout can reference your profile when answering questions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services description used by Scout & routing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-tsAccent" />
            Services You Offer
          </CardTitle>
          <CardDescription>
            Describe, in your own words, the services you perform. Scout and the auto-routing system use this
            (along with your roles, locality, and recommendations) to send you the right requests and avoid
            calls for work you don&apos;t offer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={preferences.servicesDescription || ''}
            onChange={(e) =>
              setPreferences((prev) => ({
                ...prev,
                servicesDescription: e.target.value,
              }))
            }
            rows={5}
            placeholder="Example: I specialize in small residential plumbing repairs, water heater replacements, and leak detection for single-family homes and small multi-unit buildings. I do not offer new construction rough-in work."
          />
          <div className="flex justify-end">
            <Button onClick={saveServicesDescription} disabled={loading}>
              Save services
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Site Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-tsAccent" />
            Profile Site Sections
          </CardTitle>
          <CardDescription>
            Choose which sections appear on your public profile site. Turning sections off hides them from visitors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>About</Label>
              <p className="text-sm text-tsTextMuted">
                High-level overview of who you are on TradeScout.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.about !== false}
              onCheckedChange={(value) => updateProfileSection('about', value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Roles & badges</Label>
              <p className="text-sm text-tsTextMuted">
                Show your TradeScout roles, badges, and Community Builder badge status.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.rolesAndBadges !== false}
              onCheckedChange={(value) => updateProfileSection('rolesAndBadges', value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Stats</Label>
              <p className="text-sm text-tsTextMuted">
                When available, show counts for listings, RECOMMENDATIONS, and rating.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.stats !== false}
              onCheckedChange={(value) => updateProfileSection('stats', value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Services</Label>
              <p className="text-sm text-tsTextMuted">
                For contractors and pros, show a services overview when available.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.services !== false}
              onCheckedChange={(value) => updateProfileSection('services', value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Marketplace listings</Label>
              <p className="text-sm text-tsTextMuted">
                Allow TradeScout to feature your active marketplace listings here.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.marketplaceListings !== false}
              onCheckedChange={(value) => updateProfileSection('marketplaceListings', value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>RECOMMENDATIONS</Label>
              <p className="text-sm text-tsTextMuted">
                When RECOMMENDATIONS are enabled, show your rating and testimonials.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.reviews !== false}
              onCheckedChange={(value) => updateProfileSection('reviews', value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Community activity</Label>
              <p className="text-sm text-tsTextMuted">
                Highlight your participation in TradeScout communities and boards.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.communityActivity !== false}
              onCheckedChange={(value) => updateProfileSection('communityActivity', value)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Contact card</Label>
              <p className="text-sm text-tsTextMuted">
                Show a call-to-action so visitors can reach you.
              </p>
            </div>
            <Switch
              checked={preferences.profileSections?.contactCard !== false}
              onCheckedChange={(value) => updateProfileSection('contactCard', value)}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
