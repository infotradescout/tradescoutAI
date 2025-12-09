import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { COLOR_PRESETS, getPresetNames } from "@shared/colorPresets";
import { Palette, Home, Eye, EyeOff } from "lucide-react";
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
  };
}

export default function ProfileSettings() {
  const { user, refetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultHomePage: 'llm',
    profileVisibility: 'public',
    colorScheme: { preset: 'default' },
  });

  useEffect(() => {
    if (user?.preferences) {
      setPreferences({
        defaultHomePage: user.preferences.defaultHomePage || 'llm',
        profileVisibility: user.preferences.profileVisibility || 'public',
        colorScheme: user.preferences.colorScheme || { preset: 'default' },
      });
    }
  }, [user]);

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

  const applyColorScheme = (preset: string) => {
    const colors = COLOR_PRESETS[preset] || COLOR_PRESETS.default;
    const root = document.documentElement;
    
    root.style.setProperty('--user-primary', colors.primary);
    root.style.setProperty('--user-secondary', colors.secondary);
    root.style.setProperty('--user-background', colors.background);
    root.style.setProperty('--user-text', colors.text);
    root.style.setProperty('--user-accent', colors.accent || colors.primary);
    root.style.setProperty('--user-border', colors.border || colors.background);
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
    if (preferences.colorScheme?.preset) {
      applyColorScheme(preferences.colorScheme.preset);
      applyThemeFromScheme(preferences.colorScheme.preset);
    }
  }, [preferences.colorScheme]);

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-tsTextMain mb-2">Profile Settings</h1>
        <p className="text-tsTextMuted">
          Customize your TradeScout experience. Your profile is your website.
        </p>
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
              onValueChange={updateColorScheme}
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
              </SelectContent>
            </Select>
          </div>

          {/* Color Preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {preferences.colorScheme?.preset && COLOR_PRESETS[preferences.colorScheme.preset] && (
              <>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: COLOR_PRESETS[preferences.colorScheme.preset].primary }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Primary</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: COLOR_PRESETS[preferences.colorScheme.preset].secondary }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Secondary</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: COLOR_PRESETS[preferences.colorScheme.preset].background }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Background</p>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: COLOR_PRESETS[preferences.colorScheme.preset].text }}
                  />
                  <p className="text-xs text-tsTextMuted text-center">Text</p>
                </div>
              </>
            )}
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
            Choose the first page you see when you visit TradeScout
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
    </div>
  );
}
