import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Crown,
  Download,
  Eye,
  KeyRound,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserCog,
  UserRoundPen,
  Users,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isSuperAdminLike } from "@/lib/roleChecks";
import { hasCompletedSetup } from "@/lib/setupState";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type VerificationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired"
  | "suspended";

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
  verificationStatus?: VerificationStatus;
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

type ProfileSectionKey =
  | "about"
  | "rolesAndBadges"
  | "stats"
  | "services"
  | "marketplaceListings"
  | "reviews"
  | "communityActivity"
  | "contactCard";

type ProfileForm = {
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
  profileSections: Partial<Record<ProfileSectionKey, boolean>>;
  colorSchemePreset: string;
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  colorText: string;
  emailVerified: boolean;
  addressVerified: boolean;
  onboardingCompleted: boolean;
  verificationStatus: VerificationStatus;
};

type RoleInfo = {
  level: number;
  label: string;
  icon: ComponentType<{ className?: string }>;
  className: string;
};

const ROLE_HIERARCHY: Record<string, RoleInfo> = {
  super_admin: {
    level: 100,
    label: "Super Admin",
    icon: Crown,
    className: "border-orange-400/30 bg-orange-400/10 text-orange-100",
  },
  ops_admin: {
    level: 70,
    label: "Operations Admin",
    icon: UserCog,
    className: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  },
  moderator: {
    level: 50,
    label: "Staff",
    icon: Shield,
    className: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  },
  contractor_user: {
    level: 20,
    label: "Contractor",
    icon: Users,
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  },
  accelerator_member: {
    level: 15,
    label: "Verified Contractor",
    icon: UserCheck,
    className: "border-teal-400/30 bg-teal-400/10 text-teal-100",
  },
  homeowner: {
    level: 10,
    label: "Homeowner",
    icon: Users,
    className: "border-white/15 bg-white/5 text-white/55",
  },
};

const PROFILE_SECTION_LABELS: Array<[ProfileSectionKey, string]> = [
  ["about", "About"],
  ["rolesAndBadges", "Roles and badges"],
  ["stats", "Stats"],
  ["services", "Services"],
  ["marketplaceListings", "Marketplace"],
  ["reviews", "Reviews"],
  ["communityActivity", "Community"],
  ["contactCard", "Contact card"],
];

const EMPTY_PROFILE_FORM: ProfileForm = {
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
};

const ADMIN_SAFETY_CONFIRM_PHRASE = "I UNDERSTAND THIS EDIT IS AUDITED";

function readable(value: unknown): string {
  const text = String(value || "").trim();
  return text ? text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}

function formatDate(value: unknown): string {
  if (!value) return "Date not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "Invalid date";
}

function isArchivedPlaceholderUser(email: string): boolean {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized.startsWith("archived+") && normalized.endsWith("@thetradescout.invalid");
}

function archivedOriginalEmail(targetUser: User): string {
  return String((targetUser.preferences as Record<string, unknown> | null)?.archivedEmail || "")
    .trim()
    .toLowerCase();
}

function displayEmail(targetUser: User): string {
  return isArchivedPlaceholderUser(targetUser.email)
    ? archivedOriginalEmail(targetUser) || targetUser.email
    : String(targetUser.email || "").trim();
}

function displayName(targetUser: User): string {
  const businessName = String(
    (targetUser.preferences as Record<string, unknown> | null)?.businessName || ""
  ).trim();
  if (businessName) return businessName;
  const name = `${String(targetUser.firstName || "").trim()} ${String(targetUser.lastName || "").trim()}`.trim();
  return name || displayEmail(targetUser) || targetUser.id;
}

function resolveUserRole(targetUser: User): string {
  const archivedReason = String(
    (targetUser.preferences as Record<string, unknown> | null)?.archivedReason || ""
  )
    .trim()
    .toLowerCase();
  if (isArchivedPlaceholderUser(targetUser.email) && archivedReason === "admin_import_cleanup") {
    return "business_owner";
  }
  const activeRole = String(targetUser.activeRole || "").trim();
  if (activeRole) return activeRole;
  const roles = Array.isArray(targetUser.roles)
    ? targetUser.roles.map((role) => String(role || "").trim()).filter(Boolean)
    : [];
  return roles[0] || String(targetUser.role || "").trim();
}

function roleBucket(role: string): "contractor" | "homeowner" | "business" | "other" {
  if (
    new Set([
      "contractor",
      "contractor_user",
      "handyman",
      "service_provider",
      "specialty_tradesperson",
      "designer",
      "inspector",
    ]).has(role)
  ) {
    return "contractor";
  }
  if (
    new Set(["homeowner", "renter", "landlord", "property_manager", "hoa_member"]).has(role)
  ) {
    return "homeowner";
  }
  if (
    new Set([
      "business_owner",
      "commercial_property",
      "franchise_owner",
      "startup_founder",
      "affiliate",
      "nonprofit_org",
      "community_builder",
    ]).has(role)
  ) {
    return "business";
  }
  return "other";
}

function roleInfo(role: string): RoleInfo {
  return (
    ROLE_HIERARCHY[role] || {
      level: 0,
      label: readable(role),
      icon: Users,
      className: "border-white/15 bg-white/5 text-white/55",
    }
  );
}

function verificationBadge(status: VerificationStatus | undefined) {
  if (status === "approved") {
    return <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Verified</Badge>;
  }
  if (status === "suspended") {
    return <Badge className="border-red-400/30 bg-red-400/10 text-red-200">Suspended</Badge>;
  }
  if (status === "rejected" || status === "expired") {
    return <Badge className="border-orange-400/30 bg-orange-400/10 text-orange-100">{readable(status)}</Badge>;
  }
  return <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">{readable(status || "pending")}</Badge>;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "contractor" | "homeowner" | "business">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "pending" | "suspended">("all");
  const [addressFilter, setAddressFilter] = useState<"all" | "verified" | "not_verified">("all");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "complete" | "pending">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [accountScope, setAccountScope] = useState<"all" | "active_only" | "archived_only">("active_only");
  const [manualVerifyEmail, setManualVerifyEmail] = useState("");
  const [adminSafetyKey, setAdminSafetyKey] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<Record<string, boolean>>({});
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [newRole, setNewRole] = useState("");
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({ ...EMPTY_PROFILE_FORM });

  const isSuperAdmin = isSuperAdminLike(user?.role);
  const currentRole = String(user?.role || "").trim().toLowerCase();
  const isOpsAdmin = currentRole === "ops_admin";
  const currentUserLevel = isSuperAdmin
    ? ROLE_HIERARCHY.super_admin.level
    : isOpsAdmin
      ? ROLE_HIERARCHY.ops_admin.level
      : ROLE_HIERARCHY[currentRole]?.level || 0;
  const currentAdminId = String((user as { id?: unknown } | null)?.id || "");

  const buildAdminSafety = (reason: string) => ({
    reason,
    confirmPhrase: ADMIN_SAFETY_CONFIRM_PHRASE,
    safetyKey: adminSafetyKey.trim() || undefined,
  });

  const usersQuery = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: Boolean(user) && (isSuperAdmin || currentUserLevel >= 70),
  });
  const users = usersQuery.data || [];

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest("PUT", `/api/admin/users/${userId}/role`, {
        role,
        adminSafety: buildAdminSafety(`Role update requested by admin for user ${userId}`),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserToEdit(null);
      toast({ title: "Role updated", description: "The account role was saved." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Role was not updated",
        description: formatUserFacingErrorMessage(error, "Failed to update the account role."),
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      apiRequest("DELETE", `/api/admin/users/${userId}`, {
        adminSafety: buildAdminSafety(`Account deletion requested by admin for user ${userId}`),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account deleted", description: "The account was permanently removed." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Account was not deleted",
        description: formatUserFacingErrorMessage(error, "Failed to delete the account."),
        variant: "destructive",
      });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profileUser) throw new Error("No user selected");
      const hasColor = Boolean(
        profileForm.colorSchemePreset ||
          profileForm.colorPrimary ||
          profileForm.colorSecondary ||
          profileForm.colorBackground ||
          profileForm.colorText
      );
      const colorScheme = hasColor
        ? {
            ...(profileForm.colorSchemePreset.trim()
              ? { preset: profileForm.colorSchemePreset.trim() }
              : {}),
            ...(profileForm.colorPrimary.trim() ? { primary: profileForm.colorPrimary.trim() } : {}),
            ...(profileForm.colorSecondary.trim()
              ? { secondary: profileForm.colorSecondary.trim() }
              : {}),
            ...(profileForm.colorBackground.trim()
              ? { background: profileForm.colorBackground.trim() }
              : {}),
            ...(profileForm.colorText.trim() ? { text: profileForm.colorText.trim() } : {}),
          }
        : undefined;

      return apiRequest("PUT", `/api/admin/users/${profileUser.id}/profile`, {
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
        adminSafety: buildAdminSafety(`Profile support edit requested by admin for user ${profileUser.id}`),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setProfileUser(null);
      toast({ title: "Profile updated", description: "The public profile and account state were saved." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Profile was not updated",
        description: formatUserFacingErrorMessage(error, "Failed to update the profile."),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const adminId = String((user as { id?: unknown } | null)?.id || "");
    if (!adminId) return;
    try {
      const raw = window.localStorage.getItem(`adminUsersSavedViews:${adminId}`);
      const parsed = raw ? (JSON.parse(raw) as SavedView[]) : [];
      if (!Array.isArray(parsed)) return;
      setSavedViews(parsed);
      const pinned = parsed.find((view) => view.pinned);
      if (pinned) applySavedViewRecord(pinned);
    } catch {
      // Saved views are a convenience only. Invalid local data is ignored.
    }
  }, [user]);

  useEffect(() => {
    try {
      setAdminSafetyKey(window.localStorage.getItem("ts:admin:safety-key") || "");
    } catch {
      // Strict safety-key mode can still be completed manually in this session.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("ts:admin:safety-key", adminSafetyKey);
    } catch {
      // Session state remains usable even if browser storage is unavailable.
    }
  }, [adminSafetyKey]);

  useEffect(() => {
    const adminId = String((user as { id?: unknown } | null)?.id || "");
    if (!adminId) return;
    try {
      window.localStorage.setItem(`adminUsersSavedViews:${adminId}`, JSON.stringify(savedViews));
    } catch {
      // Saved views remain usable for the current session.
    }
  }, [savedViews, user]);

  function applySavedViewRecord(view: SavedView) {
    setActiveViewId(view.id);
    setSearchTerm(view.searchTerm || "");
    setStatusFilter(view.statusFilter || "all");
    setAddressFilter(view.addressFilter || "all");
    setRoleFilter(view.roleFilter || "all");
    setOnboardingFilter(view.onboardingFilter || "all");
  }

  const applySavedView = (viewId: string) => {
    const view = savedViews.find((entry) => entry.id === viewId);
    if (view) applySavedViewRecord(view);
  };

  const saveCurrentView = () => {
    const name = window.prompt("Name this view", "New view")?.trim();
    if (!name) return;
    const id = String(Date.now());
    const next: SavedView = {
      id,
      name,
      searchTerm,
      statusFilter,
      addressFilter,
      roleFilter,
      onboardingFilter,
      createdAt: new Date().toISOString(),
    };
    setSavedViews((current) => [...current, next]);
    setActiveViewId(id);
    toast({ title: "View saved", description: `${name} is available in support tools.` });
  };

  const deleteSavedView = (viewId: string) => {
    const view = savedViews.find((entry) => entry.id === viewId);
    if (!view || !window.confirm(`Delete saved view “${view.name}”?`)) return;
    setSavedViews((current) => current.filter((entry) => entry.id !== viewId));
    if (activeViewId === viewId) setActiveViewId(null);
  };

  const pinSavedView = (viewId: string) => {
    setSavedViews((current) =>
      current.map((entry) => ({ ...entry, pinned: entry.id === viewId }))
    );
    const view = savedViews.find((entry) => entry.id === viewId);
    if (view) {
      applySavedViewRecord(view);
      toast({ title: "Default view pinned", description: `${view.name} will load first.` });
    }
  };

  const openProfileEditor = async (target: User) => {
    setProfileUser(target);
    setProfileForm({ ...EMPTY_PROFILE_FORM });
    try {
      const response = await apiRequest("POST", "/api/admin/users/info", { userId: target.id });
      const source = response?.user && typeof response.user === "object" ? response.user : {};
      const preferences =
        source.preferences && typeof source.preferences === "object" ? source.preferences : {};
      const sections =
        preferences.profileSections && typeof preferences.profileSections === "object"
          ? preferences.profileSections
          : {};
      const color =
        preferences.colorScheme && typeof preferences.colorScheme === "object"
          ? preferences.colorScheme
          : {};
      const status = String(source.verificationStatus || "pending") as VerificationStatus;
      setProfileForm({
        firstName: String(source.firstName || ""),
        lastName: String(source.lastName || ""),
        phone: String(source.phone || ""),
        city: String(source.city || ""),
        stateCode: String(source.stateCode || source.state || ""),
        countyFips: String(source.countyFips || ""),
        countyName: String(source.countyName || source.county || ""),
        profileImageUrl: String(source.profileImageUrl || ""),
        bio: typeof preferences.bio === "string" ? preferences.bio : "",
        profileVisibility: preferences.profileVisibility === "public" ? "public" : "private",
        servicesDescription:
          typeof preferences.servicesDescription === "string" ? preferences.servicesDescription : "",
        profileSections: PROFILE_SECTION_LABELS.reduce<Partial<Record<ProfileSectionKey, boolean>>>(
          (result, [key]) => ({ ...result, [key]: sections[key] }),
          {}
        ),
        colorSchemePreset: typeof color.preset === "string" ? color.preset : "",
        colorPrimary: typeof color.primary === "string" ? color.primary : "",
        colorSecondary: typeof color.secondary === "string" ? color.secondary : "",
        colorBackground: typeof color.background === "string" ? color.background : "",
        colorText: typeof color.text === "string" ? color.text : "",
        emailVerified: Boolean(source.emailVerified),
        addressVerified: Boolean(source.addressVerified),
        onboardingCompleted: Boolean(source.onboardingCompleted),
        verificationStatus: [
          "pending",
          "under_review",
          "approved",
          "rejected",
          "expired",
          "suspended",
        ].includes(status)
          ? status
          : "pending",
      });
    } catch (error: unknown) {
      toast({
        title: "Profile details unavailable",
        description: formatUserFacingErrorMessage(error, "Could not load the selected profile."),
        variant: "destructive",
      });
    }
  };

  const runUserControl = async (action: string, userId: string, newRole?: string) => {
    const key = action === "role" && newRole ? `${userId}:role:${newRole}` : `${userId}:${action}`;
    const label = action === "revoke_verify" ? "revoke verification" : action === "role" ? "change role" : action;
    const reason = window.prompt(
      `Enter reason for ${label} (minimum 12 characters):`,
      "Admin support action requested by user."
    )?.trim();
    if (!reason || reason.length < 12) {
      toast({
        title: "Audit reason required",
        description: "This action requires a reason of at least 12 characters.",
        variant: "destructive",
      });
      return;
    }

    const routes: Record<string, { url: string; body: Record<string, unknown>; success: string }> = {
      suspend: {
        url: `/api/admin/user-controls/suspend/${userId}`,
        body: { reason },
        success: "Account suspended",
      },
      unsuspend: {
        url: `/api/admin/user-controls/unsuspend/${userId}`,
        body: { reason },
        success: "Account unsuspended",
      },
      verify: {
        url: `/api/admin/user-controls/verify/${userId}`,
        body: { reason },
        success: "Account verified",
      },
      revoke_verify: {
        url: `/api/admin/user-controls/revoke-verify/${userId}`,
        body: { reason },
        success: "Verification revoked",
      },
      role: {
        url: `/api/admin/user-controls/role/${userId}`,
        body: { newRole, reason },
        success: `Role changed to ${readable(newRole)}`,
      },
    };
    const route = routes[action];
    if (!route) return;

    setPendingAction((current) => ({ ...current, [key]: true }));
    try {
      await apiRequest("POST", route.url, route.body);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: route.success });
    } catch (error: unknown) {
      toast({
        title: "Account action failed",
        description: formatUserFacingErrorMessage(error, "The account action did not complete."),
        variant: "destructive",
      });
    } finally {
      setPendingAction((current) => ({ ...current, [key]: false }));
    }
  };

  const resendVerification = async (target: User) => {
    const key = `${target.id}:resend-verification`;
    setPendingAction((current) => ({ ...current, [key]: true }));
    try {
      const response = await apiRequest("POST", "/api/auth/request-email-verification", {
        email: String(target.email || "").trim().toLowerCase(),
      });
      toast({
        title: "Verification email requested",
        description:
          response?.message || "If the account exists and is unverified, a new link was sent.",
      });
      if (response?.verificationToken) {
        console.warn("[EMAIL-VERIFY] Dev token:", response.verificationToken);
      }
    } catch (error: unknown) {
      toast({
        title: "Verification email was not requested",
        description: formatUserFacingErrorMessage(error, "Failed to request a verification email."),
        variant: "destructive",
      });
    } finally {
      setPendingAction((current) => ({ ...current, [key]: false }));
    }
  };

  const impersonate = async (target: User) => {
    const reason = window.prompt("Enter impersonation reason (minimum 5 characters):")?.trim();
    if (!reason || reason.length < 5) {
      toast({
        title: "Impersonation reason required",
        description: "Record a reason of at least five characters.",
        variant: "destructive",
      });
      return;
    }
    const key = `${target.id}:impersonate`;
    setPendingAction((current) => ({ ...current, [key]: true }));
    try {
      const response = await fetch(`/api/admin/impersonate/start/${target.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Impersonation failed");
      }
      toast({ title: "Impersonation started" });
      window.location.reload();
    } catch (error: unknown) {
      toast({
        title: "Impersonation failed",
        description: formatUserFacingErrorMessage(error, "Could not start impersonation."),
        variant: "destructive",
      });
      setPendingAction((current) => ({ ...current, [key]: false }));
    }
  };

  const handleDeleteUser = (target: User) => {
    const targetRole = resolveUserRole(target);
    if (target.id === currentAdminId) {
      toast({ title: "Account protected", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    if (isSuperAdminLike(targetRole) && !isSuperAdmin) {
      toast({
        title: "Account protected",
        description: "Only a Super Admin can delete a Super Admin account.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm(`Delete user ${displayEmail(target)}? This cannot be undone.`)) return;
    deleteUserMutation.mutate({ userId: target.id });
  };

  const availableRoles = useMemo(() => {
    if (isSuperAdmin) return Object.keys(ROLE_HIERARCHY);
    if (currentUserLevel >= 80) {
      return Object.keys(ROLE_HIERARCHY).filter(
        (role) => ROLE_HIERARCHY[role].level < currentUserLevel && role !== "super_admin"
      );
    }
    return [];
  }, [currentUserLevel, isSuperAdmin]);

  const archivedCount = users.filter((entry) => isArchivedPlaceholderUser(entry.email)).length;
  const usersInScope = users.filter((entry) => {
    const archived = isArchivedPlaceholderUser(entry.email);
    if (accountScope === "active_only") return !archived;
    if (accountScope === "archived_only") return archived;
    return true;
  });

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return usersInScope
      .filter((entry) => {
        const status = entry.verificationStatus || "pending";
        const role = resolveUserRole(entry);
        const matchesSearch =
          !normalizedSearch ||
          [entry.email, archivedOriginalEmail(entry), entry.firstName, entry.lastName, displayName(entry)]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch));
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "verified" && status === "approved") ||
          (statusFilter === "suspended" && status === "suspended") ||
          (statusFilter === "pending" && status !== "approved" && status !== "suspended");
        const matchesAddress =
          addressFilter === "all" ||
          (addressFilter === "verified" && Boolean(entry.addressVerified)) ||
          (addressFilter === "not_verified" && !entry.addressVerified);
        const bucket = roleBucket(role);
        const matchesRole = roleFilter === "all" || bucket === roleFilter;
        const setupComplete = hasCompletedSetup(entry);
        const matchesSetup =
          onboardingFilter === "all" ||
          (onboardingFilter === "complete" && setupComplete) ||
          (onboardingFilter === "pending" && !setupComplete);
        let matchesTime = true;
        if (timeFilter !== "all") {
          const createdAt = new Date(entry.createdAt).getTime();
          if (!Number.isFinite(createdAt)) matchesTime = false;
          else {
            const days = timeFilter === "24h" ? 1 : timeFilter === "7d" ? 7 : 30;
            matchesTime = Date.now() - createdAt <= days * 86_400_000;
          }
        }
        return matchesSearch && matchesStatus && matchesAddress && matchesRole && matchesSetup && matchesTime;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    addressFilter,
    onboardingFilter,
    roleFilter,
    searchTerm,
    statusFilter,
    timeFilter,
    usersInScope,
  ]);

  const counts = useMemo(
    () => ({
      active: users.filter((entry) => !isArchivedPlaceholderUser(entry.email)).length,
      verified: users.filter((entry) => entry.verificationStatus === "approved").length,
      pending: users.filter(
        (entry) => entry.verificationStatus !== "approved" && entry.verificationStatus !== "suspended"
      ).length,
      suspended: users.filter((entry) => entry.verificationStatus === "suspended").length,
    }),
    [users]
  );

  const exportCsv = () => {
    if (!filteredUsers.length) {
      toast({ title: "Nothing to export", description: "Change the filters to include at least one account." });
      return;
    }
    const escapeCsv = (value: unknown) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
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
    const rows = filteredUsers.map((entry) =>
      [
        entry.id,
        displayEmail(entry),
        archivedOriginalEmail(entry),
        isArchivedPlaceholderUser(entry.email) ? "archived_placeholder" : "active",
        entry.firstName || "",
        entry.lastName || "",
        resolveUserRole(entry),
        entry.verificationStatus || "",
        Boolean(entry.addressVerified),
        Boolean(entry.onboardingCompleted),
        entry.createdAt,
      ]
        .map(escapeCsv)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `admin-users-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export started", description: `${filteredUsers.length} accounts were included.` });
  };

  if (!user || currentUserLevel < 70) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="User operations require an operations admin role"
          description="The current session does not have permission to read or change user accounts."
        />
      </AdminWorkspace>
    );
  }

  if (usersQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Loading user accounts…
        </div>
      </AdminWorkspace>
    );
  }

  if (usersQuery.isError) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="User accounts are unavailable"
          description="The account list could not be read. No account state was changed."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => usersQuery.refetch()}
              className="border-white/15 bg-transparent text-white"
            >
              Retry
            </Button>
          }
        />
      </AdminWorkspace>
    );
  }

  return (
    <AdminWorkspace data-testid="admin-users-v2">
      <AdminSection
        title="User accounts"
        description="Search and support real user accounts. Archived import placeholders remain separate from active login accounts."
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => usersQuery.refetch()}
              disabled={usersQuery.isFetching}
              className="border-white/12 bg-white/[0.025] text-white/65"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportCsv}
              disabled={!filteredUsers.length}
              className="border-white/12 bg-white/[0.025] text-white/65"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            { label: "Active accounts", value: counts.active, detail: "Non-archived login accounts" },
            {
              label: "Verified",
              value: counts.verified,
              detail: "Accounts with approved verification status",
              tone: "good",
            },
            {
              label: "Pending",
              value: counts.pending,
              detail: "Verification or setup work remains",
              tone: counts.pending > 0 ? "warning" : "good",
            },
            {
              label: "Suspended",
              value: counts.suspended,
              detail: `${archivedCount} archived import placeholders kept separate`,
              tone: counts.suspended > 0 ? "danger" : "good",
            },
          ]}
        />

        <AdminToolbar className="mt-4 items-start md:items-center">
          <div className="relative min-w-0 flex-1 md:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, email, or archived original email"
              className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)} options={["all", "verified", "pending", "suspended"]} label="Status" />
            <FilterSelect value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)} options={["all", "contractor", "homeowner", "business"]} label="Role" />
            <FilterSelect value={addressFilter} onValueChange={(value) => setAddressFilter(value as typeof addressFilter)} options={["all", "verified", "not_verified"]} label="Address" />
            <FilterSelect value={onboardingFilter} onValueChange={(value) => setOnboardingFilter(value as typeof onboardingFilter)} options={["all", "complete", "pending"]} label="Setup" />
            <FilterSelect value={timeFilter} onValueChange={(value) => setTimeFilter(value as typeof timeFilter)} options={["all", "24h", "7d", "30d"]} label="Joined" />
            {archivedCount > 0 ? (
              <FilterSelect value={accountScope} onValueChange={(value) => setAccountScope(value as typeof accountScope)} options={["active_only", "all", "archived_only"]} label="Accounts" />
            ) : null}
          </div>
        </AdminToolbar>
      </AdminSection>

      <details className="group border-y border-white/10 bg-white/[0.014]" data-testid="admin-user-support-tools">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-4 sm:px-4 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <KeyRound className="h-4 w-4 shrink-0 text-orange-200" />
            <div className="min-w-0">
              <p className="font-semibold text-white">Admin support tools</p>
              <p className="mt-1 truncate text-xs text-white/35">
                Verification email, safety key, and saved account views
              </p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-white/35 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-6 border-t border-white/10 px-3 py-5 sm:px-4 xl:grid-cols-3">
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-white">Verification email</p>
              <p className="mt-1 text-xs leading-5 text-white/35">Request a new verification link without exposing whether an account exists.</p>
            </div>
            <Input
              value={manualVerifyEmail}
              onChange={(event) => setManualVerifyEmail(event.target.value)}
              placeholder="user@example.com"
              className="border-white/10 bg-black/20 text-white"
            />
            <Button
              type="button"
              onClick={async () => {
                const target = { id: "manual", email: manualVerifyEmail } as User;
                await resendVerification(target);
              }}
              disabled={!manualVerifyEmail.trim() || pendingAction["manual:resend-verification"]}
              className="bg-orange-500 text-black hover:bg-orange-400"
            >
              <Mail className="mr-2 h-4 w-4" />
              Send verification link
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-semibold text-white">Admin write safety key</p>
              <p className="mt-1 text-xs leading-5 text-white/35">Used only when strict privileged-write mode is enabled.</p>
            </div>
            <Input
              type="password"
              value={adminSafetyKey}
              onChange={(event) => setAdminSafetyKey(event.target.value)}
              placeholder="Safety key"
              className="border-white/10 bg-black/20 text-white"
            />
            <Button type="button" variant="outline" onClick={() => setAdminSafetyKey("")} className="border-white/12 bg-transparent text-white/60">
              Clear key
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-semibold text-white">Saved views</p>
              <p className="mt-1 text-xs leading-5 text-white/35">Store common search and status combinations for this admin session.</p>
            </div>
            <Select value={activeViewId || "none"} onValueChange={(value) => value !== "none" && applySavedView(value)}>
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Choose saved view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose saved view</SelectItem>
                {savedViews.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}{view.pinned ? " · default" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={saveCurrentView} className="border-white/12 bg-transparent text-white/60">Save current</Button>
              {activeViewId ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => pinSavedView(activeViewId)} className="border-white/12 bg-transparent text-white/60">Pin default</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => deleteSavedView(activeViewId)} className="border-red-300/20 bg-transparent text-red-100">Delete view</Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </details>

      <AdminSection
        title={`Accounts (${filteredUsers.length}${usersInScope.length !== filteredUsers.length ? ` of ${usersInScope.length}` : ""})`}
        description="Expand an account to review status and open the permitted support actions."
        className="pt-0"
      >
        {filteredUsers.length ? (
          <AdminList>
            {filteredUsers.map((target) => {
              const role = resolveUserRole(target);
              const info = roleInfo(role);
              const RoleIcon = info.icon;
              const targetLevel = ROLE_HIERARCHY[role]?.level || 0;
              const canManage = currentUserLevel > targetLevel || (isSuperAdmin && role === "super_admin");
              const canRunSuperActions = isSuperAdmin && target.id !== currentAdminId && role !== "super_admin";
              const canRunOpsActions = (isSuperAdmin || isOpsAdmin) && target.id !== currentAdminId && role !== "super_admin";
              const canDelete = isSuperAdmin && target.id !== currentAdminId && role !== "super_admin";
              const setupComplete = hasCompletedSetup(target);
              const archived = isArchivedPlaceholderUser(target.email);

              return (
                <details key={target.id} className="group">
                  <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1.25fr)_minmax(10rem,0.65fr)_minmax(14rem,0.9fr)_minmax(7rem,0.45fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-white">{displayName(target)}</p>
                        {archived ? <Archive className="h-4 w-4 shrink-0 text-amber-200" /> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-white/35">{displayEmail(target)}</p>
                    </div>
                    <Badge className={info.className}>
                      <RoleIcon className="mr-1 h-3 w-3" />
                      {info.label}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      {verificationBadge(target.verificationStatus)}
                      <Badge className={target.addressVerified ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-100" : "border-white/12 bg-white/[0.035] text-white/45"}>
                        {target.addressVerified ? "Address verified" : "Address pending"}
                      </Badge>
                      <Badge className={target.emailVerified ? "border-sky-400/25 bg-sky-400/8 text-sky-100" : "border-white/12 bg-white/[0.035] text-white/45"}>
                        {target.emailVerified ? "Email verified" : "Email pending"}
                      </Badge>
                    </div>
                    <div className="text-xs text-white/38">
                      <p>{formatDate(target.createdAt)}</p>
                      <p className="mt-1">{setupComplete ? "Setup complete" : "Setup pending"}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-white/30 transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(22rem,1.25fr)]">
                      <div className="space-y-3 text-sm leading-6 text-white/50">
                        <p><span className="text-white/28">User ID:</span> <span className="font-mono text-white/58">{target.id}</span></p>
                        <p><span className="text-white/28">Role source:</span> {readable(target.activeRole ? "active role" : Array.isArray(target.roles) && target.roles.length ? "roles array" : "legacy role")}</p>
                        <p><span className="text-white/28">Profile:</span> {target.canonicalProfileUrl || `/profile/${target.id}`}</p>
                        {archived ? <p className="text-amber-100/70">Archived import placeholder. Use Business Import for cleanup and directory ownership work.</p> : null}
                      </div>

                      <div className="flex flex-wrap items-start gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign(target.canonicalProfileUrl?.trim() || `/profile/${target.id}`)} className="border-white/12 bg-transparent text-white/60">
                          <Eye className="mr-2 h-4 w-4" />View profile
                        </Button>
                        {canManage ? (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => { setUserToEdit(target); setNewRole(role); }} className="border-white/12 bg-transparent text-white/60">
                              <UserCog className="mr-2 h-4 w-4" />Edit role
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => openProfileEditor(target)} className="border-white/12 bg-transparent text-white/60">
                              <UserRoundPen className="mr-2 h-4 w-4" />Edit profile
                            </Button>
                          </>
                        ) : null}
                        {!target.emailVerified && target.id !== currentAdminId && role !== "super_admin" ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => resendVerification(target)} disabled={pendingAction[`${target.id}:resend-verification`]} className="border-white/12 bg-transparent text-white/60">
                            <Mail className="mr-2 h-4 w-4" />Resend verification
                          </Button>
                        ) : null}

                        {(canRunSuperActions || canRunOpsActions) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" size="sm" variant="outline" className="border-white/12 bg-transparent text-white/60">
                                Account actions<MoreHorizontal className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              {canRunSuperActions ? (
                                <DropdownMenuItem onClick={() => impersonate(target)} disabled={pendingAction[`${target.id}:impersonate`]}>
                                  Impersonate
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => runUserControl("suspend", target.id)} disabled={pendingAction[`${target.id}:suspend`] || target.verificationStatus === "suspended"} className="text-red-600">
                                Suspend
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => runUserControl("unsuspend", target.id)} disabled={pendingAction[`${target.id}:unsuspend`]}>Unsuspend</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => runUserControl("verify", target.id)} disabled={pendingAction[`${target.id}:verify`] || target.verificationStatus === "approved"}>Verify</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => runUserControl("revoke_verify", target.id)} disabled={pendingAction[`${target.id}:revoke_verify`]}>Revoke verify</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => runUserControl("role", target.id, "contractor_user")} disabled={pendingAction[`${target.id}:role:contractor_user`]}>Set Contractor</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => runUserControl("role", target.id, "homeowner")} disabled={pendingAction[`${target.id}:role:homeowner`]}>Set Homeowner</DropdownMenuItem>
                              {canDelete ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteUser(target)} disabled={deleteUserMutation.isPending} className="text-red-600">Delete account</DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </AdminList>
        ) : (
          <AdminEmptyState title="No accounts match these filters" description="Change the search, account scope, or status filters to inspect another account set." />
        )}
      </AdminSection>

      <RoleDialog
        user={userToEdit}
        role={newRole}
        availableRoles={availableRoles}
        onRoleChange={setNewRole}
        onClose={() => setUserToEdit(null)}
        onSave={() => {
          if (!userToEdit || !newRole) return;
          const currentTargetRole = resolveUserRole(userToEdit);
          if ((newRole === "super_admin" || currentTargetRole === "super_admin") && !isSuperAdmin) {
            toast({ title: "Role protected", description: "Only a Super Admin can change a Super Admin role.", variant: "destructive" });
            return;
          }
          updateRoleMutation.mutate({ userId: userToEdit.id, role: newRole });
        }}
        saving={updateRoleMutation.isPending}
      />

      <ProfileDialog
        user={profileUser}
        form={profileForm}
        onFormChange={setProfileForm}
        onClose={() => setProfileUser(null)}
        onSave={() => saveProfileMutation.mutate()}
        saving={saveProfileMutation.isPending}
      />
    </AdminWorkspace>
  );
}

function FilterSelect({
  value,
  onValueChange,
  options,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[10.5rem] border-white/10 bg-black/20 text-white">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {label}: {option === "all" ? "All" : option === "24h" ? "Last 24 hours" : option === "7d" ? "Last 7 days" : option === "30d" ? "Last 30 days" : readable(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RoleDialog({
  user,
  role,
  availableRoles,
  onRoleChange,
  onClose,
  onSave,
  saving,
}: {
  user: User | null;
  role: string;
  availableRoles: string[];
  onRoleChange: (role: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/12 bg-tsBg text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Edit account role</DialogTitle>
          <DialogDescription className="text-white/45">
            {user ? `${displayName(user)} · ${displayEmail(user)}` : "Select an account."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Current role</p>
            <div className="mt-2"><Badge className={roleInfo(user ? resolveUserRole(user) : "").className}>{roleInfo(user ? resolveUserRole(user) : "").label}</Badge></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role-select" className="text-white/65">New role</Label>
            <Select value={role || undefined} onValueChange={onRoleChange}>
              <SelectTrigger id="user-role-select" className="border-white/10 bg-black/20 text-white"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>{availableRoles.map((option) => <SelectItem key={option} value={option}>{roleInfo(option).label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="border-white/12 bg-transparent text-white/60">Cancel</Button>
          <Button type="button" onClick={onSave} disabled={saving || !role} className="bg-orange-500 text-black hover:bg-orange-400">{saving ? "Saving…" : "Save role"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDialog({
  user,
  form,
  onFormChange,
  onClose,
  onSave,
  saving,
}: {
  user: User | null;
  form: ProfileForm;
  onFormChange: (next: ProfileForm | ((current: ProfileForm) => ProfileForm)) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const patch = <Key extends keyof ProfileForm>(key: Key, value: ProfileForm[Key]) =>
    onFormChange((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/12 bg-tsBg text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-white">Edit public profile and account state</DialogTitle>
          <DialogDescription className="text-white/45">
            {user ? displayEmail(user) : "Select an account."} · privileged edits are audited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-7">
          <FormSection title="Identity and location">
            <TextField label="First name" value={form.firstName} onChange={(value) => patch("firstName", value)} />
            <TextField label="Last name" value={form.lastName} onChange={(value) => patch("lastName", value)} />
            <TextField label="Phone" value={form.phone} onChange={(value) => patch("phone", value)} />
            <TextField label="City" value={form.city} onChange={(value) => patch("city", value)} />
            <TextField label="State code" value={form.stateCode} onChange={(value) => patch("stateCode", value.toUpperCase().slice(0, 2))} />
            <TextField label="County FIPS" value={form.countyFips} onChange={(value) => patch("countyFips", value.replace(/\D/g, "").slice(0, 5))} />
            <div className="sm:col-span-2"><TextField label="County name" value={form.countyName} onChange={(value) => patch("countyName", value)} /></div>
            <div className="sm:col-span-2"><TextField label="Profile image URL" value={form.profileImageUrl} onChange={(value) => patch("profileImageUrl", value)} /></div>
          </FormSection>

          <FormSection title="Public profile">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-white/65">Bio</Label>
              <Textarea value={form.bio} onChange={(event) => patch("bio", event.target.value)} className="min-h-32 border-white/10 bg-black/20 text-white" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-white/65">Services description</Label>
              <Textarea value={form.servicesDescription} onChange={(event) => patch("servicesDescription", event.target.value)} className="min-h-24 border-white/10 bg-black/20 text-white" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-white/65">Profile visibility</Label>
              <Select value={form.profileVisibility} onValueChange={(value) => patch("profileVisibility", value === "private" ? "private" : "public")}>
                <SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection title="Account state">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-white/65">Verification status</Label>
              <Select value={form.verificationStatus} onValueChange={(value) => patch("verificationStatus", value as VerificationStatus)}>
                <SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{["pending", "under_review", "approved", "rejected", "expired", "suspended"].map((status) => <SelectItem key={status} value={status}>{readable(status)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <ToggleField label="Email verified" checked={form.emailVerified} onChange={(checked) => patch("emailVerified", checked)} />
            <ToggleField label="Address verified" checked={form.addressVerified} onChange={(checked) => patch("addressVerified", checked)} />
            <div className="sm:col-span-2"><ToggleField label="Setup completed" checked={form.onboardingCompleted} onChange={(checked) => patch("onboardingCompleted", checked)} /></div>
          </FormSection>

          <section>
            <h3 className="text-sm font-semibold text-white">Public profile sections</h3>
            <div className="mt-3 grid gap-3 border-y border-white/10 px-3 py-4 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
              {PROFILE_SECTION_LABELS.map(([key, label]) => (
                <ToggleField
                  key={key}
                  label={label}
                  checked={form.profileSections[key] !== false}
                  onChange={(checked) =>
                    patch("profileSections", { ...form.profileSections, [key]: checked })
                  }
                />
              ))}
            </div>
          </section>

          <FormSection title="Profile colors">
            <TextField label="Preset" value={form.colorSchemePreset} onChange={(value) => patch("colorSchemePreset", value)} placeholder="default, warm, cool, vibrant, minimal, custom" />
            <TextField label="Primary" value={form.colorPrimary} onChange={(value) => patch("colorPrimary", value)} />
            <TextField label="Secondary" value={form.colorSecondary} onChange={(value) => patch("colorSecondary", value)} />
            <TextField label="Background" value={form.colorBackground} onChange={(value) => patch("colorBackground", value)} />
            <div className="sm:col-span-2"><TextField label="Text" value={form.colorText} onChange={(value) => patch("colorText", value)} /></div>
          </FormSection>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="border-white/12 bg-transparent text-white/60">Cancel</Button>
          <Button type="button" onClick={onSave} disabled={saving} className="bg-orange-500 text-black hover:bg-orange-400">{saving ? "Saving…" : "Save profile"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3 grid gap-4 border-y border-white/10 px-3 py-4 sm:grid-cols-2 sm:px-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white/65">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="border-white/10 bg-black/20 text-white" />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-3 text-sm text-white/62">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-orange-500" />
      <span>{label}</span>
    </label>
  );
}
