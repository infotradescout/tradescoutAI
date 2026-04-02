// Minimal user controls for super admin
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Crown,
  UserCog,
  Users,
  Search,
  MoreHorizontal,
  ChevronDown,
  Mail,
  SlidersHorizontal,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isSuperAdminLike } from "@/lib/roleChecks";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { hasCompletedSetup } from "@/lib/setupState";

type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  activeRole?: string;
  roles?: string[];
  preferences?: Record<string, unknown> | null;
  emailVerified?: boolean;
  verificationStatus?:
    | "pending"
    | "under_review"
    | "approved"
    | "rejected"
    | "expired"
    | "suspended";
  addressVerified?: boolean;
  onboardingCompleted: boolean;
  profileVersion?: number;
  createdAt: string;
  canonicalProfileUrl?: string | null;
};

type SavedView = {
  id: string;
  name: string;
  searchTerm: string;
  statusFilter: "all" | "verified" | "pending" | "suspended";
  addressFilter: "all" | "verified" | "not_verified";
  roleFilter: "all" | "contractor" | "homeowner" | "business";
  onboardingFilter: "all" | "complete" | "pending";
  pinned?: boolean;
  createdAt: string;
};

const roleHierarchy = {
  super_admin: {
    level: 100,
    label: "Super Admin",
    icon: Crown,
    color: "bg-primary text-primary-foreground",
  },
  moderator: {
    level: 50,
    label: "Staff",
    icon: Shield,
    color: "bg-primary/90 text-primary-foreground",
  },
  ops_admin: {
    level: 70,
    label: "Operations Admin",
    icon: UserCog,
    color: "bg-primary/80 text-primary-foreground",
  },
  contractor_user: {
    level: 20,
    label: "Contractor",
    icon: Users,
    color: "bg-secondary text-secondary-foreground",
  },
  accelerator_member: {
    level: 15,
    label: "Verified Contractor",
    icon: Users,
    color: "bg-accent text-accent-foreground",
  },
  homeowner: {
    level: 10,
    label: "Homeowner",
    icon: Users,
    color: "bg-muted text-muted-foreground",
  },
};

const ADMIN_SAFETY_CONFIRM_PHRASE = "I UNDERSTAND THIS EDIT IS AUDITED";

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [manualVerifyEmail, setManualVerifyEmail] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"all" | "contractor" | "homeowner" | "business">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "pending" | "suspended">(
    "all"
  );
  const [addressFilter, setAddressFilter] = useState<"all" | "verified" | "not_verified">("all");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "complete" | "pending">("all");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [accountScope, setAccountScope] = useState<"all" | "active_only" | "archived_only">(
    "active_only"
  );
  const [adminSafetyKey, setAdminSafetyKey] = useState("");
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileForm, setProfileForm] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
    city: string;
    stateCode: string;
    countyFips: string;
    countyName: string;
    profileImageUrl: string;
    bio: string;
    profileVisibility: "public" | "private";
    servicesDescription: string;
    profileSections: {
      about?: boolean;
      rolesAndBadges?: boolean;
      stats?: boolean;
      services?: boolean;
      marketplaceListings?: boolean;
      reviews?: boolean;
      communityActivity?: boolean;
      contactCard?: boolean;
    };
    colorSchemePreset: string;
    colorPrimary: string;
    colorSecondary: string;
    colorBackground: string;
    colorText: string;
    emailVerified: boolean;
    addressVerified: boolean;
    onboardingCompleted: boolean;
    verificationStatus:
      | "pending"
      | "under_review"
      | "approved"
      | "rejected"
      | "expired"
      | "suspended";
  }>({
    firstName: "",
    lastName: "",
    phone: "",
    city: "",
    stateCode: "",
    countyFips: "",
    countyName: "",
    profileImageUrl: "",
    bio: "",
    profileVisibility: "public",
    servicesDescription: "",
    profileSections: {},
    colorSchemePreset: "",
    colorPrimary: "",
    colorSecondary: "",
    colorBackground: "",
    colorText: "",
    emailVerified: false,
    addressVerified: false,
    onboardingCompleted: false,
    verificationStatus: "pending",
  });

  // Pending state for each user action (by userId + action)
  const [pendingAction, setPendingAction] = useState<{ [key: string]: boolean }>({});

  // Super Admin is the highest role
  const isSuperAdmin = isSuperAdminLike(user?.role);
  const isOpsAdmin =
    String(user?.role || "")
      .trim()
      .toLowerCase() === "ops_admin";
  const currentUserLevel = roleHierarchy[user?.role as keyof typeof roleHierarchy]?.level || 0;
  const currentAdminId = String((user as any)?.id || "");
  const currentAdminRole = String((user as any)?.role || "");
  const buildAdminSafety = (reason: string) => ({
    reason,
    confirmPhrase: ADMIN_SAFETY_CONFIRM_PHRASE,
    safetyKey: adminSafetyKey.trim() || undefined,
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isSuperAdmin || currentUserLevel >= 70, // Ops admins and above can view users
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/role`, {
        role: newRole,
        adminSafety: buildAdminSafety(`Role update requested by admin for user ${userId}`),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "User Role Updated",
        description: "The user's role has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserToEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to update user role."),
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`, {
        adminSafety: buildAdminSafety(`Account deletion requested by admin for user ${userId}`),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "The user has been successfully removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Failed to delete user."),
        variant: "destructive",
      });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profileUser) throw new Error("No user selected");
      const colorScheme =
        profileForm.colorSchemePreset ||
        profileForm.colorPrimary ||
        profileForm.colorSecondary ||
        profileForm.colorBackground ||
        profileForm.colorText
          ? {
              ...(profileForm.colorSchemePreset.trim()
                ? { preset: profileForm.colorSchemePreset.trim() }
                : {}),
              ...(profileForm.colorPrimary.trim()
                ? { primary: profileForm.colorPrimary.trim() }
                : {}),
              ...(profileForm.colorSecondary.trim()
                ? { secondary: profileForm.colorSecondary.trim() }
                : {}),
              ...(profileForm.colorBackground.trim()
                ? { background: profileForm.colorBackground.trim() }
                : {}),
              ...(profileForm.colorText.trim() ? { text: profileForm.colorText.trim() } : {}),
            }
          : undefined;

      const payload = {
        firstName: profileForm.firstName.trim() || undefined,
        lastName: profileForm.lastName.trim() || undefined,
        phone: profileForm.phone.trim() || undefined,
        city: profileForm.city.trim() || undefined,
        stateCode: profileForm.stateCode.trim() || undefined,
        countyFips: profileForm.countyFips.trim() || undefined,
        countyName: profileForm.countyName.trim() || undefined,
        profileImageUrl: profileForm.profileImageUrl.trim() || undefined,
        emailVerified: profileForm.emailVerified,
        addressVerified: profileForm.addressVerified,
        onboardingCompleted: profileForm.onboardingCompleted,
        verificationStatus: profileForm.verificationStatus,
        preferencesPatch: {
          bio: profileForm.bio,
          profileVisibility: profileForm.profileVisibility,
          servicesDescription: profileForm.servicesDescription,
          profileSections: profileForm.profileSections,
          ...(colorScheme ? { colorScheme } : {}),
        },
        adminSafety: buildAdminSafety(
          `Profile support edit requested by admin for user ${profileUser.id}`
        ),
      };
      return apiRequest("PUT", `/api/admin/users/${profileUser.id}/profile`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Public profile fields saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setProfileUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: formatUserFacingErrorMessage(error, "Failed to update profile."),
        variant: "destructive",
      });
    },
  });

  const openProfileEditor = async (target: User) => {
    setProfileUser(target);
    try {
      const resp = await apiRequest("POST", "/api/admin/users/info", { userId: target.id });
      const u = resp?.user || {};
      const prefs = (
        u?.preferences && typeof u.preferences === "object" ? u.preferences : {}
      ) as any;
      const sections = (
        prefs.profileSections && typeof prefs.profileSections === "object"
          ? prefs.profileSections
          : {}
      ) as any;
      const color = (
        prefs.colorScheme && typeof prefs.colorScheme === "object" ? prefs.colorScheme : {}
      ) as any;
      setProfileForm({
        firstName: String(u?.firstName || ""),
        lastName: String(u?.lastName || ""),
        phone: String(u?.phone || ""),
        city: String(u?.city || ""),
        stateCode: String((u as any)?.stateCode || u?.state || ""),
        countyFips: String((u as any)?.countyFips || ""),
        countyName: String((u as any)?.countyName || u?.county || ""),
        profileImageUrl: String(u?.profileImageUrl || ""),
        bio: typeof prefs.bio === "string" ? prefs.bio : "",
        profileVisibility: prefs.profileVisibility === "public" ? "public" : "private",
        servicesDescription:
          typeof prefs.servicesDescription === "string" ? prefs.servicesDescription : "",
        profileSections: {
          about: sections.about,
          rolesAndBadges: sections.rolesAndBadges,
          stats: sections.stats,
          services: sections.services,
          marketplaceListings: sections.marketplaceListings,
          reviews: sections.reviews,
          communityActivity: sections.communityActivity,
          contactCard: sections.contactCard,
        },
        colorSchemePreset: typeof color.preset === "string" ? color.preset : "",
        colorPrimary: typeof color.primary === "string" ? color.primary : "",
        colorSecondary: typeof color.secondary === "string" ? color.secondary : "",
        colorBackground: typeof color.background === "string" ? color.background : "",
        colorText: typeof color.text === "string" ? color.text : "",
        emailVerified: Boolean(u?.emailVerified),
        addressVerified: Boolean(u?.addressVerified),
        onboardingCompleted: Boolean(u?.onboardingCompleted),
        verificationStatus:
          u?.verificationStatus === "approved" ||
          u?.verificationStatus === "suspended" ||
          u?.verificationStatus === "under_review" ||
          u?.verificationStatus === "rejected" ||
          u?.verificationStatus === "expired"
            ? u.verificationStatus
            : "pending",
      });
    } catch (error: any) {
      toast({
        title: "Failed to load user profile",
        description: formatUserFacingErrorMessage(error, "Could not load profile details."),
        variant: "destructive",
      });
    }
  };

  const handleUserControl = async (action: string, userId: string, newRole?: string) => {
    const key = action === "role" && newRole ? `${userId}:role:${newRole}` : `${userId}:${action}`;
    setPendingAction((prev) => ({ ...prev, [key]: true }));
    let url = "";
    let body: any = undefined;
    let successMsg = "";
    const actionLabel =
      action === "revoke_verify"
        ? "revoke verification"
        : action === "role"
          ? "change role"
          : action;
    const reason = window.prompt(
      `Enter reason for ${actionLabel} (min 12 characters):`,
      "Admin support action requested by user."
    );
    if (!reason || reason.trim().length < 12) {
      toast({
        title: "Reason required",
        description: "This action requires an audit reason (min 12 chars).",
        variant: "destructive",
      });
      setPendingAction((prev) => ({ ...prev, [key]: false }));
      return;
    }
    const reasonPayload = { reason: reason.trim() };
    switch (action) {
      case "suspend":
        url = `/api/admin/user-controls/suspend/${userId}`;
        body = JSON.stringify(reasonPayload);
        successMsg = "User suspended";
        break;
      case "unsuspend":
        url = `/api/admin/user-controls/unsuspend/${userId}`;
        body = JSON.stringify(reasonPayload);
        successMsg = "User unsuspended";
        break;
      case "verify":
        url = `/api/admin/user-controls/verify/${userId}`;
        body = JSON.stringify(reasonPayload);
        successMsg = "User verified";
        break;
      case "revoke_verify":
        url = `/api/admin/user-controls/revoke-verify/${userId}`;
        body = JSON.stringify(reasonPayload);
        successMsg = "Verification revoked";
        break;
      case "role":
        url = `/api/admin/user-controls/role/${userId}`;
        body = JSON.stringify({ newRole, ...reasonPayload });
        successMsg = `Role updated to ${newRole?.replace("_", " ")}`;
        break;
      default:
        setPendingAction((prev) => ({ ...prev, [key]: false }));
        return;
    }
    try {
      await apiRequest("POST", url, body ? JSON.parse(body) : undefined);
      toast({ title: successMsg });
      // Refresh users list reactively instead of full page reload
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setPendingAction((prev) => ({ ...prev, [key]: false }));
    } catch (err: any) {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(err, "Action failed."),
        variant: "destructive",
      });
      setPendingAction((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleResendVerification = async (targetUser: User) => {
    const key = `${targetUser.id}:resend-verification`;
    setPendingAction((prev) => ({ ...prev, [key]: true }));
    try {
      const resp = await apiRequest("POST", "/api/auth/request-email-verification", {
        email: String(targetUser.email || "")
          .trim()
          .toLowerCase(),
      });
      toast({
        title: "Verification email requested",
        description:
          resp?.message || "If the account exists and is unverified, a new link has been sent.",
      });
      if (resp?.verificationToken) {
        console.warn("[EMAIL-VERIFY] Dev token:", resp.verificationToken);
      }
    } catch (err: any) {
      toast({
        title: "Resend failed",
        description: formatUserFacingErrorMessage(err, "Failed to request verification email."),
        variant: "destructive",
      });
    } finally {
      setPendingAction((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleUpdateRole = () => {
    if (userToEdit && newRole) {
      const currentTargetRole = resolveUserRole(userToEdit);

      // Prevent elevation to super_admin unless current user is super_admin
      if (newRole === "super_admin" && !isSuperAdmin) {
        toast({
          title: "Access Denied",
          description: "Only Super Admin can promote users to Super Admin.",
          variant: "destructive",
        });
        return;
      }

      // Prevent modification of super_admin by non-super_admin
      if (currentTargetRole === "super_admin" && !isSuperAdmin) {
        toast({
          title: "Access Denied",
          description: "Only Super Admin can modify other Super Admin accounts.",
          variant: "destructive",
        });
        return;
      }

      updateUserRoleMutation.mutate({ userId: userToEdit.id, newRole });
    }
  };

  const handleDeleteUser = (userId: string, userRole: string, userEmail?: string) => {
    if (String(userId) === currentAdminId) {
      toast({
        title: "Access Denied",
        description: "You cannot delete your own account.",
        variant: "destructive",
      });
      return;
    }

    if (isSuperAdminLike(userRole) && !isSuperAdminLike(currentAdminRole)) {
      toast({
        title: "Access Denied",
        description: "Only Super Admin can delete Super Admin accounts.",
        variant: "destructive",
      });
      return;
    }

    // Prevent deletion of super_admin by non-super_admin
    if (userRole === "super_admin" && !isSuperAdmin) {
      toast({
        title: "Access Denied",
        description: "Only Super Admin can delete Super Admin accounts.",
        variant: "destructive",
      });
      return;
    }

    if (
      confirm(
        `Delete user ${userEmail || userId}? This permanently removes account access and cannot be undone.`
      )
    ) {
      deleteUserMutation.mutate({ userId });
    }
  };

  const getRoleInfo = (role: string) => {
    return (
      roleHierarchy[role as keyof typeof roleHierarchy] || {
        level: 0,
        label: role,
        icon: Users,
        color: "bg-muted text-muted-foreground",
      }
    );
  };

  const getAvailableRoles = () => {
    if (isSuperAdmin) {
      // Super admin can assign any role
      return Object.keys(roleHierarchy);
    } else if (currentUserLevel >= 80) {
      // Moderators can assign roles below their level, but not super_admin
      return Object.keys(roleHierarchy).filter(
        (role) =>
          roleHierarchy[role as keyof typeof roleHierarchy].level < currentUserLevel &&
          role !== "super_admin"
      );
    }
    return [];
  };

  // Saved views persistence (per admin)
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = window.localStorage.getItem(`adminUsersSavedViews:${user.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedView[];
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
        const pinned = parsed.find((v) => v.pinned);
        if (pinned) {
          setActiveViewId(pinned.id);
          setSearchTerm(pinned.searchTerm || "");
          setStatusFilter(pinned.statusFilter || "all");
          setAddressFilter(pinned.addressFilter || "all");
          setRoleFilter(pinned.roleFilter || "all");
          setOnboardingFilter(pinned.onboardingFilter || "all");
        }
      }
    } catch (e) {
      console.error("Failed to load saved views", e);
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("ts:admin:safety-key") || "";
      setAdminSafetyKey(String(saved));
    } catch (e) {
      console.error("Failed to load admin safety key", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("ts:admin:safety-key", adminSafetyKey);
    } catch (e) {
      console.error("Failed to persist admin safety key", e);
    }
  }, [adminSafetyKey]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      window.localStorage.setItem(`adminUsersSavedViews:${user.id}`, JSON.stringify(savedViews));
    } catch (e) {
      console.error("Failed to persist saved views", e);
    }
  }, [user?.id, savedViews]);

  const applySavedView = (viewId: string) => {
    const view = savedViews.find((v) => v.id === viewId);
    if (!view) return;
    setActiveViewId(view.id);
    setSearchTerm(view.searchTerm || "");
    setStatusFilter(view.statusFilter || "all");
    setAddressFilter(view.addressFilter || "all");
    setRoleFilter(view.roleFilter || "all");
    setOnboardingFilter(view.onboardingFilter || "all");
  };

  const saveCurrentView = () => {
    if (!user?.id) return;
    const name = window.prompt("Name this view", "New view");
    if (!name) return;
    const id = `${Date.now()}`;
    const next: SavedView = {
      id,
      name: name.trim(),
      searchTerm,
      statusFilter,
      addressFilter,
      roleFilter,
      onboardingFilter,
      createdAt: new Date().toISOString(),
    };
    setSavedViews((prev) => [...prev, next]);
    setActiveViewId(id);
    toast({ title: "View saved", description: `Saved view \"${name.trim()}\".` });
  };

  const deleteSavedView = (viewId: string) => {
    const view = savedViews.find((v) => v.id === viewId);
    if (!view) return;
    if (!window.confirm(`Delete saved view \"${view.name}\"?`)) return;
    setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
    if (activeViewId === viewId) {
      setActiveViewId(null);
    }
  };

  const pinSavedView = (viewId: string) => {
    setSavedViews((prev) =>
      prev.map((v) => ({
        ...v,
        pinned: v.id === viewId,
      }))
    );
    setActiveViewId(viewId);
    const view = savedViews.find((v) => v.id === viewId);
    if (view) {
      applySavedView(viewId);
      toast({ title: "Pinned view", description: `\"${view.name}\" will load by default.` });
    }
  };

  const getRoleBucket = (role: string): "contractor" | "homeowner" | "business" | "other" => {
    const contractorRoles = new Set([
      "contractor",
      "contractor_user",
      "handyman",
      "service_provider",
      "specialty_tradesperson",
      "designer",
      "inspector",
    ]);
    const homeownerRoles = new Set([
      "homeowner",
      "renter",
      "landlord",
      "property_manager",
      "hoa_member",
    ]);
    const businessRoles = new Set([
      "business_owner",
      "commercial_property",
      "franchise_owner",
      "startup_founder",
      "affiliate",
      "nonprofit_org",
      "community_builder",
    ]);

    if (contractorRoles.has(role)) return "contractor";
    if (homeownerRoles.has(role)) return "homeowner";
    if (businessRoles.has(role)) return "business";
    return "other";
  };

  const resolveUserRole = (targetUser: User): string => {
    const archivedReason = String((targetUser.preferences as any)?.archivedReason || "")
      .trim()
      .toLowerCase();
    if (isArchivedPlaceholderUser(targetUser.email) && archivedReason === "admin_import_cleanup") {
      return "business_owner";
    }

    const active = String(targetUser.activeRole || "").trim();
    if (active) return active;
    const roles = Array.isArray(targetUser.roles)
      ? targetUser.roles.map((r) => String(r || "").trim()).filter(Boolean)
      : [];
    if (roles.length > 0) return roles[0];
    return String(targetUser.role || "").trim();
  };

  const isArchivedPlaceholderUser = (email: string): boolean => {
    const normalized = String(email || "")
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    return normalized.startsWith("archived+") && normalized.endsWith("@thetradescout.invalid");
  };

  const getArchivedOriginalEmail = (targetUser: User): string => {
    const raw = String((targetUser.preferences as any)?.archivedEmail || "")
      .trim()
      .toLowerCase();
    return raw;
  };

  const getDisplayEmail = (targetUser: User): string => {
    if (!isArchivedPlaceholderUser(targetUser.email)) {
      return String(targetUser.email || "").trim();
    }
    return getArchivedOriginalEmail(targetUser) || String(targetUser.email || "").trim();
  };

  const getDisplayName = (targetUser: User): string => {
    const businessName = String((targetUser.preferences as any)?.businessName || "").trim();
    if (businessName) return businessName;

    const fullName =
      `${String(targetUser.firstName || "").trim()} ${String(targetUser.lastName || "").trim()}`.trim();
    if (fullName) return fullName;
    const displayEmail = getDisplayEmail(targetUser);
    return displayEmail || String(targetUser.email || "").trim();
  };

  const archivedPlaceholderCount = useMemo(
    () => users.filter((u) => isArchivedPlaceholderUser(u.email)).length,
    [users]
  );
  const usersBase = useMemo(() => {
    if (accountScope === "archived_only") {
      return users.filter((u) => isArchivedPlaceholderUser(u.email));
    }
    if (accountScope === "active_only") {
      return users.filter((u) => !isArchivedPlaceholderUser(u.email));
    }
    return users;
  }, [users, accountScope]);

  const filteredUsers = usersBase.filter((u) => {
    const name = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : "";
    const searchLower = searchTerm.trim().toLowerCase();
    const archivedOriginalEmail = getArchivedOriginalEmail(u);
    const matchesSearch =
      !searchLower ||
      u.email.toLowerCase().includes(searchLower) ||
      archivedOriginalEmail.includes(searchLower) ||
      name.toLowerCase().includes(searchLower);

    const status = u.verificationStatus || "pending";
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && status === "approved") ||
      (statusFilter === "suspended" && status === "suspended") ||
      (statusFilter === "pending" && status !== "approved" && status !== "suspended");

    const matchesAddress =
      addressFilter === "all" ||
      (addressFilter === "verified" && !!u.addressVerified) ||
      (addressFilter === "not_verified" && !u.addressVerified);

    const bucket = getRoleBucket(resolveUserRole(u));
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "contractor" && bucket === "contractor") ||
      (roleFilter === "homeowner" && bucket === "homeowner") ||
      (roleFilter === "business" && bucket === "business");

    const userHasCompletedSetup = hasCompletedSetup(u);
    const matchesOnboarding =
      onboardingFilter === "all" ||
      (onboardingFilter === "complete" && userHasCompletedSetup) ||
      (onboardingFilter === "pending" && !userHasCompletedSetup);

    let matchesTime = true;
    if (timeFilter !== "all") {
      const created = u.createdAt ? new Date(u.createdAt) : null;
      if (!created || Number.isNaN(created.getTime())) {
        matchesTime = false;
      } else {
        const now = Date.now();
        const diffMs = now - created.getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        if (timeFilter === "24h") {
          matchesTime = diffMs <= oneDay;
        } else if (timeFilter === "7d") {
          matchesTime = diffMs <= 7 * oneDay;
        } else if (timeFilter === "30d") {
          matchesTime = diffMs <= 30 * oneDay;
        }
      }
    }

    return (
      matchesSearch &&
      matchesStatus &&
      matchesAddress &&
      matchesRole &&
      matchesOnboarding &&
      matchesTime
    );
  });

  const exportFilteredToCsv = () => {
    if (!filteredUsers.length) {
      toast({
        title: "No users to export",
        description: "Adjust filters to include at least one user.",
        variant: "destructive",
      });
      return;
    }

    const header = [
      "id",
      "email",
      "archivedOriginalEmail",
      "accountType",
      "firstName",
      "lastName",
      "role",
      "verificationStatus",
      "addressVerified",
      "onboardingCompleted",
      "createdAt",
    ];

    const escape = (val: unknown) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = filteredUsers.map((u) =>
      [
        escape(u.id),
        escape(getDisplayEmail(u)),
        escape(getArchivedOriginalEmail(u)),
        escape(isArchivedPlaceholderUser(u.email) ? "archived_placeholder" : "active"),
        escape(u.firstName || ""),
        escape(u.lastName || ""),
        escape(resolveUserRole(u)),
        escape(u.verificationStatus || ""),
        escape(u.addressVerified ? "true" : "false"),
        escape(u.onboardingCompleted ? "true" : "false"),
        escape(u.createdAt),
      ].join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.href = url;
    link.setAttribute("download", `admin-users-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export started",
      description: `Exported ${filteredUsers.length} users to CSV.`,
    });
  };

  if (!user || currentUserLevel < 70) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access user management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 overflow-auto">
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4">
        <Collapsible open={showTools} onOpenChange={setShowTools}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Badge className="bg-primary text-primary-foreground">
                  <Crown className="w-3 h-3 mr-1" />
                  Super Admin
                </Badge>
              )}
              {user.role === "moderator" && (
                <Badge className="bg-primary/90 text-primary-foreground">
                  <Shield className="w-3 h-3 mr-1" />
                  Staff
                </Badge>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline" className="border-input text-foreground">
                <SlidersHorizontal className="w-4 h-4 mr-1" />
                Tools
                <ChevronDown
                  className={`w-4 h-4 ml-2 transition-transform ${showTools ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail className="w-4 h-4" />
                  Email verification link
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1">
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <Input
                      value={manualVerifyEmail}
                      onChange={(e) => setManualVerifyEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="bg-input border-input text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      const key = `manual:resend-verification`;
                      setPendingAction((prev) => ({ ...prev, [key]: true }));
                      try {
                        const resp = await apiRequest(
                          "POST",
                          "/api/auth/request-email-verification",
                          {
                            email: manualVerifyEmail.trim().toLowerCase(),
                          }
                        );
                        toast({
                          title: "Verification email requested",
                          description:
                            resp?.message ||
                            "If the account exists and is unverified, a new link has been sent.",
                        });
                        if (resp?.verificationToken) {
                          console.warn("[EMAIL-VERIFY] Dev token:", resp.verificationToken);
                        }
                      } catch (err: any) {
                        toast({
                          title: "Resend failed",
                          description: formatUserFacingErrorMessage(
                            err,
                            "Failed to request verification email."
                          ),
                          variant: "destructive",
                        });
                      } finally {
                        setPendingAction((prev) => ({ ...prev, [key]: false }));
                      }
                    }}
                    disabled={
                      !manualVerifyEmail.trim() || pendingAction["manual:resend-verification"]
                    }
                  >
                    {pendingAction["manual:resend-verification"] ? "Sending..." : "Send link"}
                  </Button>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    Admin write safety key
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-end">
                    <div className="flex-1">
                      <Label className="text-muted-foreground text-xs">Safety key</Label>
                      <Input
                        type="password"
                        value={adminSafetyKey}
                        onChange={(e) => setAdminSafetyKey(e.target.value)}
                        placeholder="Required only when strict admin safety key mode is enabled"
                        className="bg-input border-input text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-input text-foreground hover:bg-muted"
                      onClick={() => setAdminSafetyKey("")}
                    >
                      Clear key
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">Saved views</div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <Select
                      value={activeViewId || ""}
                      onValueChange={(v: string) => {
                        if (!v) return;
                        applySavedView(v);
                      }}
                    >
                      <SelectTrigger className="w-full md:w-80 bg-input border-input text-foreground text-xs">
                        <SelectValue
                          placeholder={savedViews.length ? "Choose view" : "No views yet"}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-xs">
                        {savedViews.length === 0 && (
                          <SelectItem value="" disabled>
                            No saved views
                          </SelectItem>
                        )}
                        {savedViews.map((view) => (
                          <SelectItem key={view.id} value={view.id}>
                            {view.name}
                            {view.pinned ? " •" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-input text-foreground hover:bg-muted"
                        onClick={saveCurrentView}
                      >
                        Save view
                      </Button>
                      {activeViewId && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => deleteSavedView(activeViewId)}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-accent text-accent-foreground hover:bg-accent/10"
                            onClick={() => pinSavedView(activeViewId)}
                          >
                            Pin default
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex-1 min-w-[220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-input border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-end justify-between">
                <div className="flex flex-wrap gap-3 items-end">
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-40 bg-input border-input text-foreground text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs">
                      <SelectItem value="all">Status: All</SelectItem>
                      <SelectItem value="verified">Status: Verified</SelectItem>
                      <SelectItem value="pending">Status: Pending</SelectItem>
                      <SelectItem value="suspended">Status: Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={addressFilter} onValueChange={(v: any) => setAddressFilter(v)}>
                    <SelectTrigger className="w-44 bg-input border-input text-foreground text-xs">
                      <SelectValue placeholder="Address" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs">
                      <SelectItem value="all">Address: All</SelectItem>
                      <SelectItem value="verified">Address: Verified</SelectItem>
                      <SelectItem value="not_verified">Address: Not Verified</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                    <SelectTrigger className="w-40 bg-input border-input text-foreground text-xs">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs">
                      <SelectItem value="all">Role: All</SelectItem>
                      <SelectItem value="contractor">Role: Contractor</SelectItem>
                      <SelectItem value="homeowner">Role: Homeowner</SelectItem>
                      <SelectItem value="business">Role: Business</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={onboardingFilter}
                    onValueChange={(v: any) => setOnboardingFilter(v)}
                  >
                    <SelectTrigger className="w-44 bg-input border-input text-foreground text-xs">
                      <SelectValue placeholder="Onboarding" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs">
                      <SelectItem value="all">Onboarding: All</SelectItem>
                      <SelectItem value="complete">Onboarding: Complete</SelectItem>
                      <SelectItem value="pending">Onboarding: Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                    <SelectTrigger className="w-40 bg-input border-input text-foreground text-xs">
                      <SelectValue placeholder="Time" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs">
                      <SelectItem value="all">Time: All</SelectItem>
                      <SelectItem value="24h">Time: Last 24h</SelectItem>
                      <SelectItem value="7d">Time: Last 7 days</SelectItem>
                      <SelectItem value="30d">Time: Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {archivedPlaceholderCount > 0 && (
                  <Select value={accountScope} onValueChange={(v: any) => setAccountScope(v)}>
                    <SelectTrigger className="w-56 bg-input border-input text-foreground text-xs">
                      <SelectValue placeholder="Account scope" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-xs">
                      <SelectItem value="all">Accounts: All</SelectItem>
                      <SelectItem value="active_only">Accounts: Active only</SelectItem>
                      <SelectItem value="archived_only">
                        Accounts: Archived only ({archivedPlaceholderCount})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-foreground">
                  Users ({filteredUsers.length}
                  {usersBase.length !== filteredUsers.length ? ` of ${usersBase.length}` : ""})
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-white/70 hover:bg-tsCard"
                  onClick={exportFilteredToCsv}
                  disabled={!filteredUsers.length}
                >
                  Export CSV
                </Button>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-white/60">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  Verified
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                  Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  Suspended
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-700" />
                  Address verified
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-white/10" />
                  Address not verified
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-white/60">
              Imported companies showing up as users? Go to{" "}
              <Link href="/admin/business-import">
                <a className="text-blue-300 hover:underline">Business Import</a>
              </Link>{" "}
              and run the cleanup tool to archive import-created login accounts into unclaimed
              directory businesses.
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-ts-orange/30 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-white/70 mt-2">Loading users...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-muted-foreground min-w-[280px] sticky left-0 z-20 bg-[color:var(--surface-card)]">
                        User
                      </TableHead>
                      <TableHead className="text-muted-foreground min-w-[140px]">Role</TableHead>
                      <TableHead className="text-muted-foreground min-w-[200px]">Status</TableHead>
                      <TableHead className="text-muted-foreground min-w-[120px]">Joined</TableHead>
                      <TableHead className="text-muted-foreground min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user: User) => {
                      const resolvedRole = resolveUserRole(user);
                      const roleInfo = getRoleInfo(resolvedRole);
                      const RoleIcon = roleInfo.icon;

                      return (
                        <TableRow key={user.id} className="hover:bg-muted/50">
                          <TableCell className="py-3 min-w-[280px] sticky left-0 z-10 bg-[color:var(--surface-card)]">
                            <div className="text-foreground space-y-1">
                              <div className="font-medium truncate">{getDisplayName(user)}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {getDisplayEmail(user)}
                              </div>
                              {isArchivedPlaceholderUser(user.email) ? (
                                <div className="text-[10px] uppercase tracking-wide text-amber-400">
                                  Archived placeholder
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 min-w-[140px]">
                            <Badge className={`${roleInfo.color} text-white whitespace-nowrap`}>
                              <RoleIcon className="w-3 h-3 mr-1" />
                              {roleInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 min-w-[200px]">
                            <div className="flex flex-col gap-1.5">
                              <Badge
                                className={`text-xs whitespace-nowrap ${
                                  user.verificationStatus === "approved"
                                    ? "bg-primary text-primary-foreground"
                                    : user.verificationStatus === "suspended"
                                      ? "bg-destructive text-destructive-foreground"
                                      : "bg-secondary text-secondary-foreground"
                                }`}
                              >
                                {user.verificationStatus === "approved"
                                  ? "Verified"
                                  : user.verificationStatus === "suspended"
                                    ? "Suspended"
                                    : "Pending verification"}
                              </Badge>
                              <Badge
                                className={`text-xs whitespace-nowrap ${
                                  user.addressVerified
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {user.addressVerified ? "Address verified" : "Address not verified"}
                              </Badge>
                              <Badge
                                className={`text-xs whitespace-nowrap ${
                                  user.emailVerified
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {user.emailVerified ? "Email verified" : "Email not verified"}
                              </Badge>
                              <Badge
                                variant={hasCompletedSetup(user) ? "outline" : "secondary"}
                                className="text-xs whitespace-nowrap"
                              >
                                {hasCompletedSetup(user) ? "Setup complete" : "Setup pending"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 min-w-[120px] text-xs text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="py-3 min-w-[100px]">
                            {(() => {
                              const targetLevel =
                                roleHierarchy[resolvedRole as keyof typeof roleHierarchy]?.level ||
                                0;
                              const canManage =
                                currentUserLevel > targetLevel ||
                                (isSuperAdmin && resolvedRole === "super_admin");
                              if (!canManage) return null;

                              const canRunSuperActions =
                                isSuperAdmin &&
                                user.id !== (userToEdit?.id || "") &&
                                resolvedRole !== "super_admin";
                              const canRunOpsActions =
                                (isSuperAdmin || isOpsAdmin) &&
                                user.id !== (userToEdit?.id || "") &&
                                resolvedRole !== "super_admin";

                              const canDeleteUser =
                                isSuperAdmin &&
                                String(user.id) !== currentAdminId &&
                                resolvedRole !== "super_admin";

                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-border text-muted-foreground hover:bg-muted"
                                      title="User actions"
                                    >
                                      Actions
                                      <MoreHorizontal className="w-4 h-4 ml-2" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-64">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setUserToEdit(user);
                                        setNewRole(resolvedRole);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      Edit role
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => openProfileEditor(user)}
                                      className="cursor-pointer"
                                    >
                                      Edit profile
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        window.location.assign(
                                          typeof user.canonicalProfileUrl === "string" &&
                                            user.canonicalProfileUrl.trim().length > 0
                                            ? user.canonicalProfileUrl.trim()
                                            : `/profile/${user.id}`
                                        );
                                      }}
                                      className="cursor-pointer"
                                    >
                                      View public profile
                                    </DropdownMenuItem>

                                    {!user.emailVerified &&
                                      user.id !== (userToEdit?.id || "") &&
                                      resolvedRole !== "super_admin" && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => handleResendVerification(user)}
                                            disabled={
                                              pendingAction[`${user.id}:resend-verification`]
                                            }
                                            className="cursor-pointer"
                                          >
                                            {pendingAction[`${user.id}:resend-verification`]
                                              ? "Sending…"
                                              : "Resend verification email"}
                                          </DropdownMenuItem>
                                        </>
                                      )}

                                    {canRunSuperActions && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={async () => {
                                            const key = `${user.id}:impersonate`;
                                            const reason = window
                                              .prompt(
                                                "Enter impersonation reason (min 5 characters):"
                                              )
                                              ?.trim();

                                            if (!reason || reason.length < 5) {
                                              toast({
                                                title: "Reason required",
                                                description:
                                                  "Impersonation requires a reason of at least 5 characters.",
                                                variant: "destructive",
                                              });
                                              return;
                                            }

                                            setPendingAction((prev) => ({ ...prev, [key]: true }));
                                            try {
                                              const res = await fetch(
                                                `/api/admin/impersonate/start/${user.id}`,
                                                {
                                                  method: "POST",
                                                  headers: { "Content-Type": "application/json" },
                                                  credentials: "include",
                                                  body: JSON.stringify({ reason }),
                                                }
                                              );
                                              if (!res.ok) {
                                                const err = await res.json().catch(() => ({}));
                                                throw new Error(
                                                  err.message || "Impersonation failed"
                                                );
                                              }
                                              toast({ title: "Impersonation started" });
                                              window.location.reload();
                                            } catch (err: any) {
                                              toast({
                                                title: "Error",
                                                description: formatUserFacingErrorMessage(
                                                  err,
                                                  "Impersonation failed."
                                                ),
                                                variant: "destructive",
                                              });
                                              setPendingAction((prev) => ({
                                                ...prev,
                                                [key]: false,
                                              }));
                                            }
                                          }}
                                          disabled={pendingAction[`${user.id}:impersonate`]}
                                          className="cursor-pointer"
                                        >
                                          {pendingAction[`${user.id}:impersonate`]
                                            ? "Working…"
                                            : "Impersonate"}
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleUserControl("suspend", user.id)}
                                          disabled={
                                            pendingAction[`${user.id}:suspend`] ||
                                            user.verificationStatus === "suspended"
                                          }
                                          className="cursor-pointer text-destructive"
                                        >
                                          {pendingAction[`${user.id}:suspend`]
                                            ? "Working…"
                                            : "Suspend"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleUserControl("unsuspend", user.id)}
                                          disabled={pendingAction[`${user.id}:unsuspend`]}
                                          className="cursor-pointer"
                                        >
                                          {pendingAction[`${user.id}:unsuspend`]
                                            ? "Working…"
                                            : "Unsuspend"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleUserControl("verify", user.id)}
                                          disabled={
                                            pendingAction[`${user.id}:verify`] ||
                                            user.verificationStatus === "approved"
                                          }
                                          className="cursor-pointer"
                                        >
                                          {pendingAction[`${user.id}:verify`]
                                            ? "Working…"
                                            : "Verify"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUserControl("revoke_verify", user.id)
                                          }
                                          disabled={pendingAction[`${user.id}:revoke_verify`]}
                                          className="cursor-pointer"
                                        >
                                          {pendingAction[`${user.id}:revoke_verify`]
                                            ? "Working…"
                                            : "Revoke verify"}
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUserControl("role", user.id, "contractor_user")
                                          }
                                          disabled={
                                            pendingAction[`${user.id}:role:contractor_user`]
                                          }
                                          className="cursor-pointer"
                                        >
                                          {pendingAction[`${user.id}:role:contractor_user`]
                                            ? "Working…"
                                            : "Set Contractor"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUserControl("role", user.id, "homeowner")
                                          }
                                          disabled={pendingAction[`${user.id}:role:homeowner`]}
                                          className="cursor-pointer"
                                        >
                                          {pendingAction[`${user.id}:role:homeowner`]
                                            ? "Working…"
                                            : "Set Homeowner"}
                                        </DropdownMenuItem>
                                        {canDeleteUser && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleDeleteUser(
                                                  user.id,
                                                  resolveUserRole(user),
                                                  user.email
                                                )
                                              }
                                              disabled={deleteUserMutation.isPending}
                                              className="cursor-pointer text-destructive"
                                            >
                                              {deleteUserMutation.isPending
                                                ? "Deleting…"
                                                : "Delete User"}
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {!canRunSuperActions && canRunOpsActions && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => handleUserControl("suspend", user.id)}
                                          disabled={
                                            pendingAction[`${user.id}:suspend`] ||
                                            user.verificationStatus === "suspended"
                                          }
                                          className="cursor-pointer text-destructive"
                                        >
                                          Suspend
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleUserControl("unsuspend", user.id)}
                                          disabled={pendingAction[`${user.id}:unsuspend`]}
                                          className="cursor-pointer"
                                        >
                                          Unsuspend
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleUserControl("verify", user.id)}
                                          disabled={
                                            pendingAction[`${user.id}:verify`] ||
                                            user.verificationStatus === "approved"
                                          }
                                          className="cursor-pointer"
                                        >
                                          Verify
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUserControl("revoke_verify", user.id)
                                          }
                                          disabled={pendingAction[`${user.id}:revoke_verify`]}
                                          className="cursor-pointer"
                                        >
                                          Revoke verify
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUserControl("role", user.id, "contractor_user")
                                          }
                                          disabled={
                                            pendingAction[`${user.id}:role:contractor_user`]
                                          }
                                          className="cursor-pointer"
                                        >
                                          Set Contractor
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleUserControl("role", user.id, "homeowner")
                                          }
                                          disabled={pendingAction[`${user.id}:role:homeowner`]}
                                          className="cursor-pointer"
                                        >
                                          Set Homeowner
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Role Dialog */}
        <Dialog open={!!userToEdit} onOpenChange={() => setUserToEdit(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit User Role</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Change the role for{" "}
                {userToEdit?.firstName && userToEdit?.lastName
                  ? `${userToEdit.firstName} ${userToEdit.lastName}`
                  : userToEdit
                    ? getDisplayEmail(userToEdit)
                    : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Current Role</Label>
                <div className="mt-1">
                  <Badge
                    className={`${getRoleInfo(userToEdit ? resolveUserRole(userToEdit) : "").color}`}
                  >
                    {getRoleInfo(userToEdit ? resolveUserRole(userToEdit) : "").label}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">New Role</Label>
                <Select value={newRole || undefined} onValueChange={setNewRole}>
                  <SelectTrigger className="bg-input border-input text-foreground">
                    <SelectValue placeholder="Select new role" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role} value={role} className="text-foreground">
                        {getRoleInfo(role).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUserToEdit(null)}
                className="border-input text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateRole}
                disabled={updateUserRoleMutation.isPending || !newRole}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {updateUserRoleMutation.isPending ? "Updating..." : "Update Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Profile Dialog */}
        <Dialog open={!!profileUser} onOpenChange={() => setProfileUser(null)}>
          <DialogContent className="bg-card border-border max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit Public Profile</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Update the public-facing profile fields for{" "}
                {profileUser ? getDisplayEmail(profileUser) : "this user"}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">First name</Label>
                <Input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Last name</Label>
                <Input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">City</Label>
                <Input
                  value={profileForm.city}
                  onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">State code (2 letters)</Label>
                <Input
                  value={profileForm.stateCode}
                  onChange={(e) => setProfileForm((p) => ({ ...p, stateCode: e.target.value }))}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">County FIPS (5 digits)</Label>
                <Input
                  value={profileForm.countyFips}
                  onChange={(e) => setProfileForm((p) => ({ ...p, countyFips: e.target.value }))}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">County name</Label>
                <Input
                  value={profileForm.countyName}
                  onChange={(e) => setProfileForm((p) => ({ ...p, countyName: e.target.value }))}
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Profile image URL</Label>
                <Input
                  value={profileForm.profileImageUrl}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, profileImageUrl: e.target.value }))
                  }
                  className="bg-input border-input text-foreground"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Bio</Label>
                <Textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                  rows={6}
                  className="bg-input border-input text-foreground"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Public profile visibility</Label>
                <Select
                  value={profileForm.profileVisibility}
                  onValueChange={(v) =>
                    setProfileForm((p) => ({
                      ...p,
                      profileVisibility: v === "private" ? "private" : "public",
                    }))
                  }
                >
                  <SelectTrigger className="bg-input border-input text-foreground">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Services description</Label>
                <Textarea
                  value={profileForm.servicesDescription}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, servicesDescription: e.target.value }))
                  }
                  rows={4}
                  className="bg-input border-input text-foreground"
                />
              </div>

              <div className="md:col-span-2 space-y-3 rounded-lg border border-input p-3">
                <div className="text-sm font-semibold text-foreground">Account state</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Verification status</Label>
                    <Select
                      value={profileForm.verificationStatus}
                      onValueChange={(v) =>
                        setProfileForm((p) => ({
                          ...p,
                          verificationStatus:
                            v === "approved" ||
                            v === "suspended" ||
                            v === "under_review" ||
                            v === "rejected" ||
                            v === "expired"
                              ? v
                              : "pending",
                        }))
                      }
                    >
                      <SelectTrigger className="bg-input border-input text-foreground">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="under_review">Under review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={profileForm.emailVerified}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, emailVerified: e.target.checked }))
                      }
                    />
                    <span>Email verified</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={profileForm.addressVerified}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, addressVerified: e.target.checked }))
                      }
                    />
                    <span>Address verified</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
                    <input
                      type="checkbox"
                      checked={profileForm.onboardingCompleted}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, onboardingCompleted: e.target.checked }))
                      }
                    />
                    <span>Setup completed</span>
                  </label>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2 rounded-lg border border-input p-3">
                <div className="text-sm font-semibold text-foreground">Public profile sections</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {[
                    ["about", "About"],
                    ["rolesAndBadges", "Roles & badges"],
                    ["stats", "Stats"],
                    ["services", "Services"],
                    ["marketplaceListings", "Marketplace"],
                    ["reviews", "Reviews"],
                    ["communityActivity", "Community"],
                    ["contactCard", "Contact card"],
                  ].map(([key, label]) => {
                    const k = key as keyof typeof profileForm.profileSections;
                    const checked = (profileForm.profileSections as any)?.[k] !== false;
                    return (
                      <label key={key} className="flex items-center gap-2 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setProfileForm((p) => ({
                              ...p,
                              profileSections: {
                                ...(p.profileSections || {}),
                                [k]: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span className="text-foreground">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2 space-y-3 rounded-lg border border-input p-3">
                <div className="text-sm font-semibold text-foreground">
                  Profile colors (optional)
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Preset</Label>
                    <Input
                      value={profileForm.colorSchemePreset}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, colorSchemePreset: e.target.value }))
                      }
                      placeholder="default | warm | cool | vibrant | minimal | custom"
                      className="bg-input border-input text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Primary</Label>
                    <Input
                      value={profileForm.colorPrimary}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, colorPrimary: e.target.value }))
                      }
                      placeholder="hsl(var(--primary))"
                      className="bg-input border-input text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Secondary</Label>
                    <Input
                      value={profileForm.colorSecondary}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, colorSecondary: e.target.value }))
                      }
                      placeholder="hsl(var(--secondary))"
                      className="bg-input border-input text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Background</Label>
                    <Input
                      value={profileForm.colorBackground}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, colorBackground: e.target.value }))
                      }
                      placeholder="hsl(var(--background))"
                      className="bg-input border-input text-foreground"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Text</Label>
                    <Input
                      value={profileForm.colorText}
                      onChange={(e) => setProfileForm((p) => ({ ...p, colorText: e.target.value }))}
                      placeholder="hsl(var(--foreground))"
                      className="bg-input border-input text-foreground"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setProfileUser(null)}
                className="border-input text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveProfileMutation.mutate()}
                disabled={saveProfileMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saveProfileMutation.isPending ? "Saving..." : "Save profile"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
