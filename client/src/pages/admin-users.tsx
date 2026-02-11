// Minimal user controls for super admin
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Crown, UserCog, Users, Search, MoreHorizontal, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
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
  createdAt: string;
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
  head_admin: {
    level: 110,
    label: "Head Admin",
    icon: Crown,
    color: "bg-primary text-primary-foreground",
  },
  super_admin: {
    level: 100,
    label: "Super Admin",
    icon: Crown,
    color: "bg-primary text-primary-foreground",
  },
  moderator: {
    level: 80,
    label: "Moderator",
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
    label: "Accelerator Member",
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

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [manualVerifyEmail, setManualVerifyEmail] = useState("");
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
  });

  // Pending state for each user action (by userId + action)
  const [pendingAction, setPendingAction] = useState<{ [key: string]: boolean }>({});

  // Super Admin is the highest role
  const isSuperAdmin = user?.role === "super_admin" || user?.role === "head_admin";
  const currentUserLevel = roleHierarchy[user?.role as keyof typeof roleHierarchy]?.level || 0;

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isSuperAdmin || currentUserLevel >= 70, // Ops admins and above can view users
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/role`, {
        role: newRole,
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
        description: error.message || "Failed to update user role.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
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
        description: error.message || "Failed to delete user.",
        variant: "destructive",
      });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profileUser) throw new Error("No user selected");
      const payload = {
        firstName: profileForm.firstName.trim() || undefined,
        lastName: profileForm.lastName.trim() || undefined,
        phone: profileForm.phone.trim() || undefined,
        city: profileForm.city.trim() || undefined,
        stateCode: profileForm.stateCode.trim() || undefined,
        countyFips: profileForm.countyFips.trim() || undefined,
        countyName: profileForm.countyName.trim() || undefined,
        profileImageUrl: profileForm.profileImageUrl.trim() || undefined,
        preferencesPatch: { bio: profileForm.bio },
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
        description: error?.message || "Failed to update profile.",
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
      });
    } catch (error: any) {
      toast({
        title: "Failed to load user profile",
        description: error?.message || "Could not load profile details.",
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
    switch (action) {
      case "suspend":
        url = `/api/admin/user-controls/suspend/${userId}`;
        successMsg = "User suspended";
        break;
      case "unsuspend":
        url = `/api/admin/user-controls/unsuspend/${userId}`;
        successMsg = "User unsuspended";
        break;
      case "verify":
        url = `/api/admin/user-controls/verify/${userId}`;
        successMsg = "User verified";
        break;
      case "revoke_verify":
        url = `/api/admin/user-controls/revoke-verify/${userId}`;
        successMsg = "Verification revoked";
        break;
      case "role":
        url = `/api/admin/user-controls/role/${userId}`;
        body = JSON.stringify({ newRole });
        successMsg = `Role updated to ${newRole?.replace("_", " ")}`;
        break;
      default:
        setPendingAction((prev) => ({ ...prev, [key]: false }));
        return;
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Action failed");
      }
      toast({ title: successMsg });
      // Refresh users list reactively instead of full page reload
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setPendingAction((prev) => ({ ...prev, [key]: false }));
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Action failed",
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
        description: err?.message || "Failed to request verification email.",
        variant: "destructive",
      });
    } finally {
      setPendingAction((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleUpdateRole = () => {
    if (userToEdit && newRole) {
      const targetLevel = roleHierarchy[newRole as keyof typeof roleHierarchy]?.level || 0;

      // Prevent elevation to super_admin unless current user is super_admin
      if (newRole === "super_admin" && !isSuperAdmin) {
        toast({
          title: "Access Denied",
          description: "Only the head admin can promote users to head admin status.",
          variant: "destructive",
        });
        return;
      }

      // Prevent modification of super_admin by non-super_admin
      if (userToEdit.role === "super_admin" && !isSuperAdmin) {
        toast({
          title: "Access Denied",
          description: "Only the head admin can modify other head admin accounts.",
          variant: "destructive",
        });
        return;
      }

      updateUserRoleMutation.mutate({ userId: userToEdit.id, newRole });
    }
  };

  const handleDeleteUser = (userId: string, userRole: string) => {
    // Prevent deletion of super_admin by non-super_admin
    if (userRole === "super_admin" && !isSuperAdmin) {
      toast({
        title: "Access Denied",
        description: "Only the head admin can delete other head admin accounts.",
        variant: "destructive",
      });
      return;
    }

    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUserMutation.mutate(userId);
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
      // Head admin can assign any role
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

  const filteredUsers = users.filter((u) => {
    const name = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : "";
    const searchLower = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !searchLower ||
      u.email.toLowerCase().includes(searchLower) ||
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

    const bucket = getRoleBucket(u.role);
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "contractor" && bucket === "contractor") ||
      (roleFilter === "homeowner" && bucket === "homeowner") ||
      (roleFilter === "business" && bucket === "business");

    const matchesOnboarding =
      onboardingFilter === "all" ||
      (onboardingFilter === "complete" && u.onboardingCompleted) ||
      (onboardingFilter === "pending" && !u.onboardingCompleted);

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
        escape(u.email),
        escape(u.firstName || ""),
        escape(u.lastName || ""),
        escape(u.role),
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
    <div className="h-full bg-background p-6">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">User Management</h1>
            <p className="text-muted-foreground">Manage user roles and permissions</p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Badge className="bg-primary text-primary-foreground">
                <Crown className="w-3 h-3 mr-1" />
                {user?.role === "head_admin" ? "Head Admin" : "Super Admin"}
              </Badge>
            )}
            {user.role === "moderator" && (
              <Badge className="bg-primary/90 text-primary-foreground">
                <Shield className="w-3 h-3 mr-1" />
                Moderator
              </Badge>
            )}
          </div>
        </div>

        <Card className="bg-card border-border mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">Email Verification</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
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
                    const resp = await apiRequest("POST", "/api/auth/request-email-verification", {
                      email: manualVerifyEmail.trim().toLowerCase(),
                    });
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
                      description: err?.message || "Failed to request verification email.",
                      variant: "destructive",
                    });
                  } finally {
                    setPendingAction((prev) => ({ ...prev, [key]: false }));
                  }
                }}
                disabled={!manualVerifyEmail.trim() || pendingAction["manual:resend-verification"]}
              >
                {pendingAction["manual:resend-verification"] ? "Sending..." : "Send link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 min-w-[220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-input border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 items-stretch lg:flex-row lg:items-center lg:justify-end">
                {user && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Saved views</span>
                    <Select
                      value={activeViewId || ""}
                      onValueChange={(v: string) => {
                        if (!v) return;
                        applySavedView(v);
                      }}
                    >
                      <SelectTrigger className="w-44 bg-input border-input text-foreground text-xs">
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
                )}
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
                <Select value={onboardingFilter} onValueChange={(v: any) => setOnboardingFilter(v)}>
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
                  {users.length !== filteredUsers.length ? ` of ${users.length}` : ""})
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-navy-600 text-gray-200 hover:bg-navy-700"
                  onClick={exportFilteredToCsv}
                  disabled={!filteredUsers.length}
                >
                  Export CSV
                </Button>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
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
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-600" />
                  Address not verified
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-300 mt-2">Loading users...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground">User</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Joined</TableHead>
                    <TableHead className="text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user: User) => {
                    const roleInfo = getRoleInfo(user.role);
                    const RoleIcon = roleInfo.icon;

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="text-foreground">
                            <div className="font-medium">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.email}
                            </div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            <div className="mt-1 text-xs">
                              <Link
                                href={`/profile/${user.id}`}
                                className="text-primary hover:text-primary/80 hover:underline"
                              >
                                View public profile
                              </Link>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={`${roleInfo.color} text-white`}>
                              <RoleIcon className="w-3 h-3 mr-1" />
                              {roleInfo.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              className={
                                user.verificationStatus === "approved"
                                  ? "bg-primary text-primary-foreground"
                                  : user.verificationStatus === "suspended"
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-secondary text-secondary-foreground"
                              }
                            >
                              {user.verificationStatus === "approved"
                                ? "Verified"
                                : user.verificationStatus === "suspended"
                                  ? "Suspended"
                                  : "Pending verification"}
                            </Badge>
                            <Badge
                              className={
                                user.addressVerified
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {user.addressVerified ? "Address verified" : "Address not verified"}
                            </Badge>
                            <Badge
                              className={
                                user.emailVerified
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {user.emailVerified ? "Email verified" : "Email not verified"}
                            </Badge>
                            <Badge variant={user.onboardingCompleted ? "outline" : "secondary"}>
                              {user.onboardingCompleted ? "Onboarding complete" : "Setup pending"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {/* Admin Controls: Grouped and with dropdown for less common actions */}
                          {(currentUserLevel >
                            roleHierarchy[user.role as keyof typeof roleHierarchy]?.level ||
                            (isSuperAdmin && user.role === "super_admin")) && (
                            <div className="flex flex-wrap gap-2 items-center">
                              {/* Primary Actions */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setUserToEdit(user);
                                  setNewRole(user.role);
                                }}
                                className="border-border text-muted-foreground hover:bg-muted"
                                title="Edit user role"
                              >
                                Edit Role
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openProfileEditor(user)}
                                className="border-border text-muted-foreground hover:bg-muted"
                                title="Edit public profile fields"
                              >
                                Edit Profile
                              </Button>
                              {isSuperAdmin &&
                                user.id !== (userToEdit?.id || "") &&
                                user.role !== "super_admin" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      const key = `${user.id}:impersonate`;
                                      setPendingAction((prev) => ({ ...prev, [key]: true }));
                                      try {
                                        const res = await fetch(
                                          `/api/admin/impersonate/start/${user.id}`,
                                          {
                                            method: "POST",
                                            credentials: "include",
                                          }
                                        );
                                        if (!res.ok) {
                                          const err = await res.json().catch(() => ({}));
                                          throw new Error(err.message || "Impersonation failed");
                                        }
                                        toast({ title: "Impersonation started" });
                                        window.location.reload();
                                      } catch (err: any) {
                                        toast({
                                          title: "Error",
                                          description: err.message || "Impersonation failed",
                                          variant: "destructive",
                                        });
                                        setPendingAction((prev) => ({ ...prev, [key]: false }));
                                      }
                                    }}
                                    className="border-accent text-accent-foreground hover:bg-accent/10"
                                    title="Impersonate user"
                                    disabled={pendingAction[`${user.id}:impersonate`]}
                                  >
                                    {pendingAction[`${user.id}:impersonate`]
                                      ? "Working…"
                                      : "Impersonate"}
                                  </Button>
                                )}
                              {/* Status Controls */}
                              {isSuperAdmin &&
                                user.id !== (userToEdit?.id || "") &&
                                user.role !== "super_admin" && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUserControl("suspend", user.id)}
                                      className="border-destructive text-destructive hover:bg-destructive/10"
                                      title={
                                        user.verificationStatus === "suspended"
                                          ? "User is already suspended"
                                          : "Suspend user"
                                      }
                                      disabled={
                                        pendingAction[`${user.id}:suspend`] ||
                                        user.verificationStatus === "suspended"
                                      }
                                    >
                                      {pendingAction[`${user.id}:suspend`] ? "Working…" : "Suspend"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUserControl("unsuspend", user.id)}
                                      className="border-primary text-primary hover:bg-primary/10"
                                      title="Unsuspend user"
                                      disabled={pendingAction[`${user.id}:unsuspend`]}
                                    >
                                      {pendingAction[`${user.id}:unsuspend`]
                                        ? "Working…"
                                        : "Unsuspend"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUserControl("verify", user.id)}
                                      className="border-primary text-primary hover:bg-primary/10"
                                      title={
                                        user.verificationStatus === "approved"
                                          ? "User is already verified"
                                          : "Verify user"
                                      }
                                      disabled={
                                        pendingAction[`${user.id}:verify`] ||
                                        user.verificationStatus === "approved"
                                      }
                                    >
                                      {pendingAction[`${user.id}:verify`] ? "Working…" : "Verify"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUserControl("revoke_verify", user.id)}
                                      className="border-muted text-muted-foreground hover:bg-muted/10"
                                      title="Revoke verification"
                                      disabled={pendingAction[`${user.id}:revoke_verify`]}
                                    >
                                      {pendingAction[`${user.id}:revoke_verify`]
                                        ? "Working…"
                                        : "Revoke Verify"}
                                    </Button>
                                  </div>
                                )}
                              {/* Quick actions dropdown (resend is useful for all admin roles) */}
                              {user.id !== (userToEdit?.id || "") &&
                                user.role !== "super_admin" && (
                                  <div className="relative group">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-secondary text-secondary-foreground group-hover:bg-secondary/10"
                                      title="Quick actions"
                                    >
                                      More
                                    </Button>
                                    <div className="absolute left-0 z-10 hidden group-hover:block bg-popover border border-border rounded shadow-lg mt-1 min-w-[180px]">
                                      {!user.emailVerified && (
                                        <button
                                          onClick={() => handleResendVerification(user)}
                                          className="block w-full text-left px-4 py-2 text-foreground hover:bg-muted"
                                          disabled={pendingAction[`${user.id}:resend-verification`]}
                                        >
                                          {pendingAction[`${user.id}:resend-verification`]
                                            ? "Sending..."
                                            : "Resend verification email"}
                                        </button>
                                      )}
                                      {isSuperAdmin && (
                                        <>
                                          <button
                                            onClick={() =>
                                              handleUserControl("role", user.id, "contractor_user")
                                            }
                                            className="block w-full text-left px-4 py-2 text-foreground hover:bg-muted"
                                            disabled={
                                              pendingAction[`${user.id}:role:contractor_user`]
                                            }
                                          >
                                            {pendingAction[`${user.id}:role:contractor_user`]
                                              ? "Working…"
                                              : "Set Contractor"}
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleUserControl("role", user.id, "homeowner")
                                            }
                                            className="block w-full text-left px-4 py-2 text-foreground hover:bg-muted"
                                            disabled={pendingAction[`${user.id}:role:homeowner`]}
                                          >
                                            {pendingAction[`${user.id}:role:homeowner`]
                                              ? "Working…"
                                              : "Set Homeowner"}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              {/* (Optional) Delete user button, if ever enabled */}
                              {/* {user.id !== user.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteUser(user.id, user.role)}
                                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )} */}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
                  : userToEdit?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Current Role</Label>
                <div className="mt-1">
                  <Badge className={`${getRoleInfo(userToEdit?.role || "").color}`}>
                    {getRoleInfo(userToEdit?.role || "").label}
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
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit Public Profile</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Update the public-facing profile fields for {profileUser?.email || "this user"}.
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
