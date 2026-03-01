import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import { Link, useSearch } from "wouter";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Smartphone,
  Mail,
  Lock,
  Eye,
  CreditCard,
  Briefcase,
  Home,
  Wrench,
  Car,
  Building,
  Users,
  Heart,
  CheckCircle2,
  UtensilsCrossed,
  Truck,
  Wine,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { StateCountySelector } from "@/components/state-county-selector";
import DragDropNavigationPreferences from "@/components/navigation/DragDropNavigationPreferences";
import { NotificationPreferences as NotificationPreferencesDialog } from "@/components/ui/notification-preferences";
import { registerPushNotifications, unregisterPushSubscription } from "@/lib/pushNotifications";
import { getRoleUiConfig, SELF_SERVICE_ROLE_KEYS } from "@/lib/roleUiConfig";
import UserTypeSelect from "@/components/UserTypeSelect";
import { ACCOUNT_CREATION_USER_TYPES } from "@shared/userTypes";

type HandednessPreference = "right" | "left";

type HoaMembership = {
  hoaId: string;
  hoaName: string;
  role: string;
  status: string;
  stateCode: string | null;
  countyFips: string | null;
  groupType?: string;
};

export default function Settings() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locationStateCode, setLocationStateCode] = useState<string>(
    (user as any)?.stateCode || ""
  );
  const [locationCountyFips, setLocationCountyFips] = useState<string>(
    (user as any)?.countyFips || ""
  );
  const [locationCountyName, setLocationCountyName] = useState<string>(
    (user as any)?.countyName || (user as any)?.county || ""
  );

  const searchString = useSearch();
  const defaultTab = useMemo(() => {
    const tab = new URLSearchParams(searchString).get("tab");
    return tab || "profile";
  }, [searchString]);

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    profileImageUrl: user?.profileImageUrl || "",
    bio: (user as any)?.preferences?.bio || "",
  });

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      profileImageUrl: user?.profileImageUrl || "",
      bio: (user as any)?.preferences?.bio || "",
    });
  }, [
    user?.firstName,
    user?.lastName,
    (user as any)?.profileImageUrl,
    (user as any)?.preferences?.bio,
  ]);

  const [notifications, setNotifications] = useState(() => {
    const saved = (user as any)?.preferences?.notificationPrefs;
    return {
      email: saved?.email ?? true,
      sms: saved?.sms ?? false,
      push: saved?.push ?? true,
      marketing: saved?.marketing ?? false,
    };
  });

  useEffect(() => {
    const saved = (user as any)?.preferences?.notificationPrefs;
    if (!saved) return;
    setNotifications({
      email: saved?.email ?? true,
      sms: saved?.sms ?? false,
      push: saved?.push ?? true,
      marketing: saved?.marketing ?? false,
    });
  }, [(user as any)?.preferences?.notificationPrefs]);

  const [pushStatus, setPushStatus] = useState({
    supported: false,
    permission: null as NotificationPermission | null,
    registered: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSW = "serviceWorker" in navigator;
    const hasPush = "PushManager" in window;
    const permission = typeof Notification !== "undefined" ? Notification.permission : null;

    if (!hasSW || !hasPush) {
      setPushStatus({ supported: false, permission, registered: false });
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => {
        setPushStatus({ supported: true, permission, registered: !!sub });
      })
      .catch(() => {
        setPushStatus((prev) => ({ ...prev, supported: false }));
      });
  }, []);

  const [privacy, setPrivacy] = useState(() => {
    const prefs = (user as any)?.preferences || {};
    return {
      profileVisibility: (prefs.profileVisibility as "public" | "private") || "public",
      showInSearch: prefs.showInSearch !== false,
      contactPolicy: (prefs.contactPolicy as string) || "verified",
      twoFactorEnabled: Boolean(prefs.twoFactorEnabled),
    };
  });

  useEffect(() => {
    const prefs = (user as any)?.preferences || {};
    setPrivacy({
      profileVisibility: (prefs.profileVisibility as "public" | "private") || "public",
      showInSearch: prefs.showInSearch !== false,
      contactPolicy: (prefs.contactPolicy as string) || "verified",
      twoFactorEnabled: Boolean(prefs.twoFactorEnabled),
    });
  }, [(user as any)?.preferences]);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [handedness, setHandedness] = useState<HandednessPreference>(() => {
    if (typeof window === "undefined") return "right";
    try {
      const stored = window.localStorage.getItem("ts:handedness");
      if (stored === "left" || stored === "right") return stored;
    } catch {
      // ignore storage errors
    }
    const prefs = (user as any)?.preferences || {};
    if (prefs.handedness === "left" || prefs.handedness === "right") {
      return prefs.handedness;
    }
    return "right";
  });

  const { data: userPreferences } = useQuery<Record<string, any>>({
    queryKey: ["/api/users/preferences"],
    enabled: Boolean(user),
    retry: false,
  });

  const { data: notificationChannelPreferences } = useQuery<{
    enableEmailNotifications?: boolean;
    enableSmsNotifications?: boolean;
    enablePushNotifications?: boolean;
  }>({
    queryKey: ["/api/notifications/preferences"],
    enabled: Boolean(user),
    retry: false,
  });

  const { data: navigationPrefs } = useQuery<{
    customOrder?: string[];
    hiddenFromSwipe?: string[];
    enableSwipeNavigation?: boolean;
  }>({
    queryKey: ["/api/user/navigation-preferences"],
    enabled: Boolean(user),
    retry: false,
  });

  const { data: hoaMembershipData } = useQuery<{ memberships: HoaMembership[] }>({
    queryKey: ["/api/hoa"],
    queryFn: async () => {
      const res = await fetch("/api/hoa");
      if (!res.ok) throw new Error("Failed to load HOA memberships");
      return res.json();
    },
    enabled: Boolean(user),
    retry: false,
  });

  const memberships = hoaMembershipData?.memberships ?? [];
  const activeHoaId = memberships[0]?.hoaId;
  const activeHoaName = memberships[0]?.hoaName;

  // Get user's current roles
  const userRoles = user?.roles || [user?.role].filter(Boolean);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(userRoles);

  // Multi user-type selection (business/account personas)
  const normalizeRoleId = (value: string) => {
    const role = (value || "").trim();
    if (role === "contractor_user") return "contractor";
    if (role === "vehicle_dealer" || role === "car_salesman") return "car_dealer";
    return role;
  };

  const selectableUserTypeIds = new Set(ACCOUNT_CREATION_USER_TYPES);

  const [selectedUserTypes, setSelectedUserTypes] = useState<string[]>(() => {
    const base = Array.isArray(userRoles) ? (userRoles as string[]) : [];
    return base.map((r) => normalizeRoleId(r)).filter((r) => selectableUserTypeIds.has(r));
  });

  useEffect(() => {
    if (!userPreferences) return;

    const prefs = userPreferences || {};
    const notifPrefs = prefs.notificationPrefs || {};

    setProfileForm((prev) => ({
      ...prev,
      bio: typeof prefs.bio === "string" ? prefs.bio : prev.bio,
    }));

    setPrivacy((prev) => ({
      ...prev,
      profileVisibility: prefs.profileVisibility === "private" ? "private" : "public",
      showInSearch: prefs.showInSearch !== false,
      contactPolicy:
        typeof prefs.contactPolicy === "string" && prefs.contactPolicy.length > 0
          ? prefs.contactPolicy
          : "verified",
      twoFactorEnabled: Boolean(prefs.twoFactorEnabled),
    }));

    setNotifications((prev) => ({
      ...prev,
      email: notifPrefs.email ?? prev.email,
      sms: notifPrefs.sms ?? prev.sms,
      push: notifPrefs.push ?? prev.push,
      marketing: notifPrefs.marketing ?? prev.marketing,
    }));

    if (prefs.handedness === "left" || prefs.handedness === "right") {
      setHandedness(prefs.handedness);
    }
  }, [userPreferences]);

  useEffect(() => {
    if (!notificationChannelPreferences) return;
    setNotifications((prev) => ({
      ...prev,
      email: notificationChannelPreferences.enableEmailNotifications ?? prev.email,
      sms: notificationChannelPreferences.enableSmsNotifications ?? prev.sms,
      push: notificationChannelPreferences.enablePushNotifications ?? prev.push,
    }));
  }, [notificationChannelPreferences]);

  // Update roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      return apiRequest("PATCH", "/api/user/roles", { roles });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Roles Updated!",
        description:
          "Your account roles have been updated. Your dashboard will refresh automatically.",
      });
      // Reload to update dashboard
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update roles. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateUserTypesMutation = useMutation({
    mutationFn: async (types: string[]) => {
      return apiRequest("PATCH", "/api/user/user-types", { userTypes: types });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Account Types Updated!",
        description: "Your business and account types have been updated.",
      });
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update account types. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleKey)) {
        // Don't allow removing all roles
        if (prev.length === 1) {
          toast({
            title: "Cannot Remove",
            description: "You must have at least one role.",
            variant: "destructive",
          });
          return prev;
        }
        return prev.filter((r) => r !== roleKey);
      } else {
        return [...prev, roleKey];
      }
    });
  };

  const updateLocationMutation = useMutation({
    mutationFn: async (payload: { stateCode: string; countyFips: string; countyName?: string }) => {
      const result = await apiRequest("PUT", "/api/user/profile", {
        stateCode: payload.stateCode,
        countyFips: payload.countyFips,
        countyName: payload.countyName,
      });

      try {
        const { recordActivity } = await import("../agent/activity");
        recordActivity({
          type: "settings_location_saved",
          ts: new Date().toISOString(),
          path: typeof window !== "undefined" ? window.location.pathname : "",
          meta: {
            stateCode: payload.stateCode,
            countyFips: payload.countyFips,
          },
        });
      } catch {
        // ignore telemetry failures
      }

      return result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Ensure auth user and any location-aware hooks see the new values immediately
      try {
        refetch?.();
      } catch {
        // ignore refetch failures; invalidateQueries will still refresh eventually
      }

      // Mirror the canonical location into localStorage for fast boot/offline.
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const payload = {
            stateCode: variables.stateCode,
            countyFips: variables.countyFips,
            countyName: variables.countyName ?? "",
          };
          window.localStorage.setItem("userLocation", JSON.stringify(payload));
        }
      } catch {
        // best-effort only; do not block UX on storage issues
      }

      toast({
        title: "Location Saved",
        description: "Your location settings were updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update location. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveRoles = () => {
    if (selectedRoles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one role.",
        variant: "destructive",
      });
      return;
    }
    updateRolesMutation.mutate(selectedRoles);
  };

  const saveUserTypes = () => {
    if (selectedUserTypes.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one account type.",
        variant: "destructive",
      });
      return;
    }
    updateUserTypesMutation.mutate(selectedUserTypes);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      const mergedPreferences = {
        ...existingPrefs,
        bio: profileForm.bio,
      };
      return apiRequest("PUT", "/api/user/profile", {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        profileImageUrl: profileForm.profileImageUrl,
        preferences: mergedPreferences,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/preferences"] });
      toast({
        title: "Saved",
        description: "Your profile settings were updated.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.all([
        apiRequest("PATCH", "/api/users/preferences", {
          notificationPrefs: notifications,
        }),
        apiRequest("POST", "/api/notifications/preferences", {
          enableEmailNotifications: notifications.email,
          enableSmsNotifications: notifications.sms,
          enablePushNotifications: notifications.push,
        }),
      ]);
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({ title: "Saved", description: "Notification preferences updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to save notifications.",
        variant: "destructive",
      });
    },
  });

  const updatePrivacyMutation = useMutation({
    mutationFn: async (nextPrivacy: typeof privacy) => {
      // profileVisibility has a dedicated endpoint (also updates prefs internally)
      await apiRequest("PATCH", "/api/users/profile-visibility", {
        profileVisibility: nextPrivacy.profileVisibility,
        ...(nextPrivacy.profileVisibility === "public" ? { proceedUnverified: true } : {}),
      });
      return apiRequest("PATCH", "/api/users/preferences", {
        showInSearch: nextPrivacy.showInSearch,
        contactPolicy: nextPrivacy.contactPolicy,
        twoFactorEnabled: nextPrivacy.twoFactorEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/preferences"] });
      toast({ title: "Saved", description: "Privacy preferences updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to save privacy preferences.",
        variant: "destructive",
      });
    },
  });

  const updateHandednessMutation = useMutation({
    mutationFn: async (nextHandedness: HandednessPreference) => {
      const existingPrefs = ((user as any)?.preferences || {}) as Record<string, any>;
      const mergedPreferences = {
        ...existingPrefs,
        handedness: nextHandedness,
      };
      return apiRequest("PATCH", "/api/users/preferences", mergedPreferences);
    },
    onSuccess: (_data, variables) => {
      try {
        window.localStorage.setItem("ts:handedness", variables);
      } catch {
        // ignore storage errors
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/preferences"] });
      toast({ title: "Saved", description: "Handedness preference updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to save handedness preference.",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      toast({ title: "Password updated", description: "Your password has been changed." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to change password.",
        variant: "destructive",
      });
    },
  });

  const [advancedNotificationPrefsOpen, setAdvancedNotificationPrefsOpen] = useState(false);

  const leaveHoAMutation = useMutation({
    mutationFn: async (data: { reason: string }) => {
      if (!activeHoaId) throw new Error("No active HOA membership");
      const response = await fetch(`/api/hoa/${activeHoaId}/membership`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: data.reason }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to leave HOA");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "You left the HOA",
        description: "Your membership has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to leave HOA",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUploadClick = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { publicUrl } = await uploadObject(file);
      setProfileForm((prev) => ({ ...prev, profileImageUrl: publicUrl }));
      toast({ title: "Photo uploaded", description: "Click Save Changes to apply it." });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload photo.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="pb-20 lg:pb-0">
      <div className="container mx-auto px-4 py-6 lg:py-10">
        <div className="max-w-5xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8">
          {/* Modern Header */}
          <div className="mb-8 lg:mb-12">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-5xl font-bold text-white mb-1">Settings</h1>
                <p className="text-lg text-white/60">Manage your account preferences and privacy</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="w-full bg-tsCard border border-white/10 p-1.5 rounded-xl shadow-lg overflow-x-auto flex lg:grid lg:grid-cols-7">
              <TabsTrigger
                value="profile"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Profile
              </TabsTrigger>
              <TabsTrigger
                value="roles"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Roles
              </TabsTrigger>
              <TabsTrigger
                value="navigation"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Navigation
              </TabsTrigger>
              <TabsTrigger
                value="appearance"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Appearance
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="privacy"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Privacy
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Security
              </TabsTrigger>
              <TabsTrigger
                value="tools"
                className="data-[state=active]:bg-ts-orange data-[state=active]:text-white transition-all rounded-lg"
              >
                Financial Tools
              </TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile">
              <div className="space-y-6">
                {activeHoaId && (
                  <Card className="bg-tsCard border-white/10 shadow-xl">
                    <CardHeader className="border-b border-white/10 pb-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl text-white">HOA Membership</CardTitle>
                          <p className="text-sm text-white/60 mt-1">
                            Leave through the official channel (reason required).
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          disabled={leaveHoAMutation.isPending}
                          onClick={() => {
                            const reason = window.prompt(
                              `Why are you leaving ${activeHoaName || "this HOA"}? (min 5 characters)`
                            );
                            if (!reason) return;
                            if (reason.trim().length < 5) {
                              toast({
                                title: "Reason required",
                                description: "Please provide at least 5 characters.",
                                variant: "destructive",
                              });
                              return;
                            }
                            leaveHoAMutation.mutate({ reason: reason.trim() });
                          }}
                        >
                          Leave HOA
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="text-sm text-white/70">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-white/60">Current HOA</span>
                          <span className="text-white font-medium">
                            {activeHoaName || "Your HOA"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Profile Information</CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Update your personal details and profile
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-6">
                    {/* Profile Photo Section */}
                    <div className="flex items-center gap-6 pb-6 border-b border-white/10">
                      <div className="h-20 w-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        {profileForm.profileImageUrl ? (
                          <img
                            src={profileForm.profileImageUrl}
                            alt="Profile"
                            className="h-20 w-20 rounded-full object-cover"
                          />
                        ) : (
                          <>
                            {user?.firstName?.[0]}
                            {user?.lastName?.[0]}
                          </>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">Profile Photo</h3>
                        <p className="text-sm text-white/60 mb-3">Update your profile picture</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white"
                          onClick={handleUploadClick}
                        >
                          Upload Photo
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoSelected}
                        />
                      </div>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-white font-medium">
                          First Name
                        </Label>
                        <Input
                          id="firstName"
                          value={profileForm.firstName}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))
                          }
                          className="bg-tsBg border-white/10 text-white h-11 focus:border-ts-orange/30 transition-colors"
                          placeholder="Enter first name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-white font-medium">
                          Last Name
                        </Label>
                        <Input
                          id="lastName"
                          value={profileForm.lastName}
                          onChange={(e) =>
                            setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))
                          }
                          className="bg-tsBg border-white/10 text-white h-11 focus:border-ts-orange/30 transition-colors"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    {/* Email Field */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="email"
                        className="text-white font-medium flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4 text-ts-orange" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        defaultValue={user?.email || ""}
                        disabled
                        className="bg-tsBg border-white/10 text-white h-11 focus:border-ts-orange/30 transition-colors"
                        placeholder="email@example.com"
                      />
                      <p className="text-xs text-white/60">
                        We'll never share your email with anyone
                      </p>
                    </div>

                    {/* Bio Field */}
                    <div className="space-y-2">
                      <Label htmlFor="bio" className="text-white font-medium">
                        Bio
                      </Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell us about yourself..."
                        value={profileForm.bio}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, bio: e.target.value }))
                        }
                        className="bg-tsBg border-white/10 text-white min-h-[120px] focus:border-ts-orange/30 transition-colors resize-none"
                        rows={5}
                      />
                      <p className="text-xs text-white/60">
                        Brief description for your profile. Maximum 500 characters.
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                      <Button
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 shadow-lg"
                        onClick={() => updateProfileMutation.mutate()}
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 text-white/70 hover:bg-tsBg"
                        onClick={() =>
                          setProfileForm({
                            firstName: user?.firstName || "",
                            lastName: user?.lastName || "",
                            profileImageUrl: user?.profileImageUrl || "",
                            bio:
                              (userPreferences as any)?.bio ||
                              (user as any)?.preferences?.bio ||
                              "",
                          })
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Home Location</CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Set your home location once. This powers all your local experiences:
                          community, marketplace, HOA tools, and leaderboards.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="space-y-2">
                      <Label className="text-white font-medium">Home region</Label>
                      <p className="text-xs text-white/60">
                        Scout uses your saved location to match you with local activity and
                        experiences. Changing it here updates everything.
                      </p>
                    </div>
                    <StateCountySelector
                      selectedState={locationStateCode}
                      selectedCounty={locationCountyFips}
                      onStateChange={(code) => {
                        setLocationStateCode(code);
                        setLocationCountyFips("");
                        setLocationCountyName("");
                      }}
                      onCountyChange={(fips) => setLocationCountyFips(fips)}
                      onCountySelected={(county) => setLocationCountyName(county?.name || "")}
                      disabled={updateLocationMutation.isPending}
                    />
                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10 flex-col sm:flex-row">
                      <p className="text-xs text-white/60 max-w-xl">
                        Device location (when shared) helps Scout understand what&apos;s nearby, but
                        your saved location here is what unlocks local experiences.
                      </p>
                      <Button
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 shadow-lg w-full sm:w-auto"
                        disabled={
                          updateLocationMutation.isPending ||
                          !locationStateCode ||
                          !locationCountyFips
                        }
                        onClick={() =>
                          updateLocationMutation.mutate({
                            stateCode: locationStateCode,
                            countyFips: locationCountyFips,
                            countyName: locationCountyName,
                          })
                        }
                      >
                        {updateLocationMutation.isPending ? "Saving…" : "Save Location"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Home className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Home Vault</CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Keep private records for your properties: inspections, upgrades,
                          appliances, and documents.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
                      <p className="text-xs text-white/60 max-w-xl">
                        This is account-only. Nothing you add here is public.
                      </p>
                      <Button
                        asChild
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 shadow-lg w-full sm:w-auto"
                      >
                        <Link href="/homes">Open Home Vault</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Car className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Vehicle Vault</CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Keep private records for your vehicles: service history, repairs, and
                          documents.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
                      <p className="text-xs text-white/60 max-w-xl">
                        Account-only. Use this to build trust when you decide to sell.
                      </p>
                      <Button
                        asChild
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 shadow-lg w-full sm:w-auto"
                      >
                        <Link href="/vehicles">Open Vehicle Vault</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Navigation Settings */}
            <TabsContent value="navigation">
              <div className="space-y-6">
                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Navigation Preferences</CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Customize the order and visibility of your mobile navigation.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <DragDropNavigationPreferences
                      preferences={{
                        customOrder: navigationPrefs?.customOrder || [],
                        hiddenFromSwipe: navigationPrefs?.hiddenFromSwipe || [],
                        enableSwipeNavigation: navigationPrefs?.enableSwipeNavigation ?? true,
                      }}
                      userRole={(user as any)?.role || ""}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Roles Management */}
            <TabsContent value="roles">
              <Card
                className="border border-white/10 shadow-xl"
                style={{ backgroundColor: "var(--surface-card)" }}
              >
                <CardHeader className="border-b border-white/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-ts-orange" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Manage Your Roles</CardTitle>
                      <p className="text-sm text-white/60 mt-1">
                        Select all the roles that apply to you. Your dashboard and experience will
                        automatically adapt.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  {/* Current Roles Summary */}
                  <div className="bg-gradient-to-br from-tsBg to-tsCard border border-white/10 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="h-5 w-5 text-ts-orange" />
                      <h3 className="text-white font-semibold text-lg">Currently Active Roles</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoles.length > 0 ? (
                        selectedRoles.map((roleKey) => {
                          const config = getRoleUiConfig(roleKey);
                          if (!config.icon) return null;
                          const Icon = config.icon;
                          return (
                            <Badge
                              key={roleKey}
                              className="bg-ts-orange text-white px-3 py-1.5 text-sm font-medium flex items-center gap-1.5"
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {config.label}
                            </Badge>
                          );
                        })
                      ) : (
                        <p className="text-white/60 text-sm">No roles selected</p>
                      )}
                    </div>
                  </div>

                  {/* Account Types & Business Personas */}
                  <div className="bg-tsBg border border-white/10 rounded-xl p-6 shadow-lg space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-5 w-5 text-ts-orange" />
                      <h3 className="text-white font-semibold text-lg">
                        Account Types &amp; Business Personas
                      </h3>
                    </div>
                    <p className="text-sm text-white/60 mb-2">
                      Select all the ways you use TradeScout — homeowner, landlord, restaurant
                      owner, contractor, and more. Scout will use these types to personalize your
                      dashboards and recommendations.
                    </p>
                    <UserTypeSelect
                      selectedTypes={selectedUserTypes}
                      onChange={setSelectedUserTypes}
                      className="mt-2"
                    />
                    <div className="flex justify-end pt-4 border-t border-white/10 mt-2">
                      <Button
                        onClick={saveUserTypes}
                        disabled={
                          updateUserTypesMutation.isPending || selectedUserTypes.length === 0
                        }
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-8 shadow-lg disabled:opacity-50"
                      >
                        {updateUserTypesMutation.isPending ? "Saving…" : "Save Account Types"}
                      </Button>
                    </div>
                  </div>

                  {/* Available Roles */}
                  <div>
                    <h3 className="text-white font-semibold text-lg mb-5">Available Roles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {SELF_SERVICE_ROLE_KEYS.map((roleKey) => {
                        const config = getRoleUiConfig(roleKey);
                        if (!config.icon) return null;
                        const Icon = config.icon;
                        const isSelected = selectedRoles.includes(roleKey);
                        return (
                          <div
                            key={roleKey}
                            onClick={() => toggleRole(roleKey)}
                            className={`
                              relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg
                              ${
                                isSelected
                                  ? "bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-ts-orange/30 shadow-orange-500/20"
                                  : "bg-tsBg border-white/10 hover:border-ts-orange/30 hover:bg-tsCard/50"
                              }
                            `}
                            data-testid={`role-option-${roleKey}`}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={`p-3 rounded-xl transition-all ${isSelected ? "bg-ts-orange shadow-lg" : "bg-tsCard"}`}
                              >
                                <Icon
                                  className={`h-6 w-6 ${isSelected ? "text-white" : "text-ts-orange"}`}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <h4 className="font-semibold text-white text-base">
                                    {config.label}
                                  </h4>
                                  {isSelected && (
                                    <CheckCircle2 className="h-5 w-5 text-ts-orange" />
                                  )}
                                </div>
                                {config.desc && (
                                  <p className="text-sm text-white/60 leading-relaxed">
                                    {config.desc}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <span className="text-ts-orange font-bold text-sm">
                          {selectedRoles.length}
                        </span>
                      </div>
                      <p className="text-sm text-white/70">
                        role{selectedRoles.length !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                    <Button
                      onClick={saveRoles}
                      disabled={updateRolesMutation.isPending || selectedRoles.length === 0}
                      className="bg-ts-orange hover:bg-ts-orange-dark text-white px-8 shadow-lg disabled:opacity-50"
                      data-testid="button-save-roles"
                    >
                      {updateRolesMutation.isPending ? "Saving..." : "Save Roles"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance & Layout Settings */}
            <TabsContent value="appearance">
              <div className="space-y-6">
                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Palette className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Profile Colors & Theme</CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Profile colors are managed from your Profile Settings so your in-app theme
                          and public profile stay in sync.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <p className="text-white/70 text-sm">
                      Your color scheme is now driven by your profile color settings. Updating your
                      profile colors will update how TradeScout looks to you and how your public
                      profile appears to others.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 shadow-lg"
                        asChild
                      >
                        <Link href="/profile-settings">Open Profile Settings</Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 text-white/70 hover:border-ts-orange/30 hover:text-ts-orange px-6"
                        onClick={async () => {
                          try {
                            await fetch("/api/users/color-scheme", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              credentials: "include",
                              body: JSON.stringify({ preset: "default" }),
                            });
                            await refetch();
                            window.location.reload();
                          } catch {}
                        }}
                      >
                        Reset to Default
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">
                          Handedness & One-Handed Layout
                        </CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Choose how top controls and key buttons are aligned so they are easier to
                          reach with one hand.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-white/70">Handedness</Label>
                      <p className="text-xs text-white/60">
                        Right-handed keeps primary controls on the right. Left-handed moves them to
                        the left side of the screen.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        variant={handedness === "right" ? "default" : "outline"}
                        className={
                          handedness === "right"
                            ? "bg-ts-orange hover:bg-ts-orange-dark text-white flex-1"
                            : "border-white/10 text-white/70 hover:border-ts-orange/30 flex-1"
                        }
                        onClick={() => setHandedness("right")}
                      >
                        Right-handed layout
                      </Button>
                      <Button
                        type="button"
                        variant={handedness === "left" ? "default" : "outline"}
                        className={
                          handedness === "left"
                            ? "bg-ts-orange hover:bg-ts-orange-dark text-white flex-1"
                            : "border-white/10 text-white/70 hover:border-ts-orange/30 flex-1"
                        }
                        onClick={() => setHandedness("left")}
                      >
                        Left-handed layout
                      </Button>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-white/10 mt-2">
                      <Button
                        type="button"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 shadow-lg"
                        disabled={updateHandednessMutation.isPending}
                        onClick={() => updateHandednessMutation.mutate(handedness)}
                      >
                        {updateHandednessMutation.isPending ? "Saving…" : "Save Handedness"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-tsCard border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Troubleshooting</CardTitle>
                        <p className="text-sm text-white/60 mt-1">
                          Fix "old version" issues after deploys
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <p className="text-sm text-white/70">
                      If the app looks wrong after an update (or you see the new version for a split
                      second and it reverts), use this to clear cached assets and refresh.
                    </p>
                    <p className="text-xs text-white/60">
                      Build{" "}
                      <span className="font-mono text-white/70">
                        {typeof __APP_BUILD_ID__ === "string"
                          ? __APP_BUILD_ID__.slice(0, 12)
                          : String(__APP_BUILD_ID__)}
                      </span>{" "}
                      - Host <span className="font-mono text-white/70">{window.location.host}</span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white px-6 shadow-lg"
                        onClick={() => {
                          try {
                            const url = new URL(window.location.href);
                            url.searchParams.set("__reset", "1");
                            window.location.assign(url.toString());
                          } catch {
                            window.location.assign(`${window.location.pathname}?__reset=1`);
                          }
                        }}
                      >
                        Repair &amp; Reload
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 text-white/70 hover:border-ts-orange/30 hover:text-ts-orange px-6"
                        onClick={() => window.location.reload()}
                      >
                        Normal reload
                      </Button>
                    </div>
                    <p className="text-xs text-white/60">
                      This does not change your account. It only clears local caches and reloads the
                      app.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications">
              <Card className="bg-tsCard border-white/10 shadow-xl">
                <CardHeader className="border-b border-white/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-ts-orange" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Notification Preferences</CardTitle>
                      <p className="text-sm text-white/60 mt-1">
                        Choose how you want to receive updates and alerts
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {Object.entries({
                    email: {
                      icon: Mail,
                      label: "Email Notifications",
                      desc: "Receive updates via email",
                    },
                    sms: {
                      icon: Smartphone,
                      label: "SMS Notifications",
                      desc: "Get text message alerts",
                    },
                    push: {
                      icon: Bell,
                      label: "Push Notifications",
                      desc: "Browser and app notifications",
                    },
                    marketing: {
                      icon: Globe,
                      label: "Marketing Communications",
                      desc: "Updates about new features and offers",
                    },
                  }).map(([key, config]) => {
                    const Icon = config.icon;
                    const isPush = key === "push";
                    const pushDisabled =
                      isPush && (!pushStatus.supported || pushStatus.permission === "denied");
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 bg-tsBg rounded-xl border border-white/10 hover:border-ts-orange/30 transition-all"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-ts-orange" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{config.label}</p>
                            <p className="text-white/60 text-sm">{config.desc}</p>
                            {isPush && (
                              <p className="text-xs text-white/60 mt-1">
                                {pushStatus.permission === "denied"
                                  ? "Browser notifications are blocked for this site. Enable them in your browser settings to turn push on."
                                  : pushStatus.registered
                                    ? "Registered on this device. Delivered to this device only."
                                    : "Delivered to this device only on supported browsers."}
                              </p>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={notifications[key as keyof typeof notifications]}
                          disabled={pushDisabled}
                          onCheckedChange={async (checked) => {
                            if (isPush && pushDisabled) return;
                            setNotifications((prev) => ({ ...prev, [key]: checked }));
                            if (isPush) {
                              if (checked) {
                                const sub = await registerPushNotifications();
                                const permission =
                                  typeof Notification !== "undefined"
                                    ? Notification.permission
                                    : pushStatus.permission;
                                setPushStatus((prev) => ({
                                  ...prev,
                                  registered: !!sub,
                                  permission,
                                }));
                              } else {
                                await unregisterPushSubscription();
                                const permission =
                                  typeof Notification !== "undefined"
                                    ? Notification.permission
                                    : pushStatus.permission;
                                setPushStatus((prev) => ({
                                  ...prev,
                                  registered: false,
                                  permission,
                                }));
                              }
                            }
                          }}
                        />
                      </div>
                    );
                  })}

                  <div className="mt-6 p-4 bg-tsBg rounded-xl border border-dashed border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-white font-medium">Advanced per-area controls</p>
                      <p className="text-white/60 text-sm">
                        Fine-tune notifications for Marketplace, Community, HOA, wallet events, and
                        more by channel.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white px-4"
                      onClick={() => setAdvancedNotificationPrefsOpen(true)}
                    >
                      Open advanced preferences
                    </Button>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                      onClick={() => updateNotificationsMutation.mutate()}
                      disabled={updateNotificationsMutation.isPending}
                      className="bg-ts-orange hover:bg-ts-orange-dark text-white px-8 shadow-lg"
                    >
                      {updateNotificationsMutation.isPending ? "Saving…" : "Save Notifications"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Settings */}
            <TabsContent value="privacy">
              <Card className="bg-tsCard border-white/10 shadow-xl">
                <CardHeader className="border-b border-white/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                      <Eye className="w-5 h-5 text-ts-orange" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Privacy Settings</CardTitle>
                      <p className="text-sm text-white/60 mt-1">
                        Control who can see your information and contact you
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="flex items-center justify-between p-4 bg-tsBg rounded-xl border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Profile Visibility</p>
                        <p className="text-white/60 text-sm">
                          Make your profile visible to other users
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={privacy.profileVisibility === "public"}
                      onCheckedChange={(checked) =>
                        setPrivacy((prev) => ({
                          ...prev,
                          profileVisibility: checked ? "public" : "private",
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-tsBg rounded-xl border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Globe className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Show in Search Results</p>
                        <p className="text-white/60 text-sm">
                          Allow others to find you through search
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={privacy.showInSearch}
                      onCheckedChange={(checked) =>
                        setPrivacy((prev) => ({ ...prev, showInSearch: checked }))
                      }
                    />
                  </div>

                  <div className="space-y-3 p-4 bg-tsBg rounded-xl border border-white/10">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <Label className="text-white font-medium">Who can contact you?</Label>
                        <p className="text-white/60 text-sm">Choose who can send you messages</p>
                      </div>
                    </div>
                    <Select
                      value={privacy.contactPolicy}
                      onValueChange={(value) =>
                        setPrivacy((prev) => ({ ...prev, contactPolicy: value }))
                      }
                    >
                      <SelectTrigger className="bg-tsCard border-white/10 text-white h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-tsCard border-white/10">
                        <SelectItem value="everyone">Everyone</SelectItem>
                        <SelectItem value="verified">Verified users only</SelectItem>
                        <SelectItem value="contractors">Contractors only</SelectItem>
                        <SelectItem value="none">No one</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => updatePrivacyMutation.mutate(privacy)}
                      disabled={updatePrivacyMutation.isPending}
                      className="bg-ts-orange hover:bg-ts-orange-dark text-white px-8 shadow-lg"
                    >
                      {updatePrivacyMutation.isPending ? "Saving…" : "Save Privacy"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security">
              <Card className="bg-tsCard border-white/10 shadow-xl">
                <CardHeader className="border-b border-white/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-ts-orange" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Security Settings</CardTitle>
                      <p className="text-sm text-white/60 mt-1">
                        Manage your password and account security
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="p-6 bg-tsBg rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                        <Lock className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Change Password</h3>
                        <p className="text-sm text-white/60">Update your account password</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Current Password</Label>
                        <Input
                          type="password"
                          placeholder="Enter current password"
                          value={passwordForm.currentPassword}
                          onChange={(e) =>
                            setPasswordForm((prev) => ({
                              ...prev,
                              currentPassword: e.target.value,
                            }))
                          }
                          className="bg-tsCard border-white/10 text-white h-11 focus:border-ts-orange/30 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium">New Password</Label>
                        <Input
                          type="password"
                          placeholder="Enter new password"
                          value={passwordForm.newPassword}
                          onChange={(e) =>
                            setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                          }
                          className="bg-tsCard border-white/10 text-white h-11 focus:border-ts-orange/30 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Confirm New Password</Label>
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          value={passwordForm.confirmNewPassword}
                          onChange={(e) =>
                            setPasswordForm((prev) => ({
                              ...prev,
                              confirmNewPassword: e.target.value,
                            }))
                          }
                          className="bg-tsCard border-white/10 text-white h-11 focus:border-ts-orange/30 transition-colors"
                        />
                      </div>
                      <Button
                        className="bg-ts-orange hover:bg-ts-orange-dark text-white w-full mt-2 shadow-lg"
                        disabled={
                          changePasswordMutation.isPending ||
                          !passwordForm.currentPassword ||
                          !passwordForm.newPassword ||
                          passwordForm.newPassword !== passwordForm.confirmNewPassword
                        }
                        onClick={() => {
                          if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
                            toast({
                              title: "Error",
                              description: "New passwords do not match.",
                              variant: "destructive",
                            });
                            return;
                          }
                          changePasswordMutation.mutate();
                        }}
                      >
                        {changePasswordMutation.isPending ? "Updating…" : "Update Password"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-tsBg rounded-xl border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-ts-orange" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">Two-Factor Authentication</p>
                        <p className="text-white/60 text-sm">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white px-6"
                      onClick={() => {
                        const nextPrivacy = {
                          ...privacy,
                          twoFactorEnabled: !privacy.twoFactorEnabled,
                        };
                        setPrivacy(nextPrivacy);
                        updatePrivacyMutation.mutate(nextPrivacy);
                      }}
                    >
                      {privacy.twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Financial Tools List */}
            <TabsContent value="tools">
              <Card className="bg-tsCard border-white/10 shadow-xl">
                <CardHeader className="border-b border-white/10 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-ts-orange" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">Financial Tools</CardTitle>
                      <p className="text-sm text-white/60 mt-1">
                        Quick access to calculators and helpers for your finances.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg mb-1">
                          Invoice Calculator
                        </h3>
                        <p className="text-sm text-white/60 mb-2">
                          Check payment math and totals for your invoices.
                        </p>
                        <a
                          href="/finances/invoices"
                          className="text-ts-orange underline hover:text-ts-orange text-sm"
                        >
                          Open Invoices
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg mb-1">
                          Estimate Calculator
                        </h3>
                        <p className="text-sm text-white/60 mb-2">
                          Double-check your job estimates before sending.
                        </p>
                        <a
                          href="/quote-calculator"
                          className="text-ts-orange underline hover:text-ts-orange text-sm"
                        >
                          Open Quote Calculator
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg mb-1">Expense Helper</h3>
                        <p className="text-sm text-white/60 mb-2">
                          Split, categorize, or review your expenses for better tracking.
                        </p>
                        <a
                          href="/finances/expenses"
                          className="text-ts-orange underline hover:text-ts-orange text-sm"
                        >
                          Open Expenses
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          <NotificationPreferencesDialog
            open={advancedNotificationPrefsOpen}
            onOpenChange={setAdvancedNotificationPrefsOpen}
          />
        </div>
      </div>
    </div>
  );
}
