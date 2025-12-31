// Minimal user controls for super admin
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  verificationStatus?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'suspended';
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
  head_admin: { level: 100, label: "Head Admin", icon: Crown, color: "bg-purple-500" },
  super_admin: { level: 90, label: "Super Admin", icon: Crown, color: "bg-indigo-500" },
  moderator: { level: 80, label: "Moderator", icon: Shield, color: "bg-blue-500" },
  ops_admin: { level: 70, label: "Operations Admin", icon: UserCog, color: "bg-green-500" },
  contractor_user: { level: 20, label: "Contractor", icon: Users, color: "bg-orange-500" },
  accelerator_member: { level: 15, label: "Accelerator Member", icon: Users, color: "bg-yellow-500" },
  homeowner: { level: 10, label: "Homeowner", icon: Users, color: "bg-slate-900/60" },
};

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "contractor" | "homeowner" | "business">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "pending" | "suspended">("all");
  const [addressFilter, setAddressFilter] = useState<"all" | "verified" | "not_verified">("all");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "complete" | "pending">("all");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  // Pending state for each user action (by userId + action)
  const [pendingAction, setPendingAction] = useState<{ [key: string]: boolean }>({});

  // Check if current user is head admin
  const isHeadAdmin = user?.role === 'head_admin';
  const currentUserLevel = roleHierarchy[user?.role as keyof typeof roleHierarchy]?.level || 0;

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isHeadAdmin || currentUserLevel >= 70, // Moderators and above can view users
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/role`, { role: newRole });
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

  const handleUserControl = async (action: string, userId: string, newRole?: string) => {
    const key = action === 'role' && newRole ? `${userId}:role:${newRole}` : `${userId}:${action}`;
    setPendingAction((prev) => ({ ...prev, [key]: true }));
    let url = '';
    let body: any = undefined;
    let successMsg = '';
    switch (action) {
      case 'suspend': url = `/api/admin/user-controls/suspend/${userId}`; successMsg = 'User suspended'; break;
      case 'unsuspend': url = `/api/admin/user-controls/unsuspend/${userId}`; successMsg = 'User unsuspended'; break;
      case 'verify': url = `/api/admin/user-controls/verify/${userId}`; successMsg = 'User verified'; break;
      case 'revoke_verify': url = `/api/admin/user-controls/revoke-verify/${userId}`; successMsg = 'Verification revoked'; break;
      case 'role': url = `/api/admin/user-controls/role/${userId}`; body = JSON.stringify({ newRole }); successMsg = `Role updated to ${newRole?.replace('_', ' ')}`; break;
      default: setPendingAction((prev) => ({ ...prev, [key]: false })); return;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Action failed');
      }
      toast({ title: successMsg });
      // Refresh users list reactively instead of full page reload
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setPendingAction((prev) => ({ ...prev, [key]: false }));
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Action failed',
        variant: 'destructive',
      });
      setPendingAction((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleUpdateRole = () => {
    if (userToEdit && newRole) {
      const targetLevel = roleHierarchy[newRole as keyof typeof roleHierarchy]?.level || 0;
      
      // Prevent elevation to head_admin unless current user is head_admin
      if (newRole === 'head_admin' && !isHeadAdmin) {
        toast({
          title: "Access Denied",
          description: "Only the head admin can promote users to head admin status.",
          variant: "destructive",
        });
        return;
      }

      // Prevent modification of head_admin by non-head_admin
      if (userToEdit.role === 'head_admin' && !isHeadAdmin) {
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
    // Prevent deletion of head_admin by non-head_admin
    if (userRole === 'head_admin' && !isHeadAdmin) {
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
    return roleHierarchy[role as keyof typeof roleHierarchy] || {
      level: 0,
      label: role,
      icon: Users,
      color: 'bg-slate-900/60'
    };
  };

  const getAvailableRoles = () => {
    if (isHeadAdmin) {
      // Head admin can assign any role
      return Object.keys(roleHierarchy);
    } else if (currentUserLevel >= 80) {
      // Moderators can assign roles below their level, but not head_admin
      return Object.keys(roleHierarchy).filter(role => 
        roleHierarchy[role as keyof typeof roleHierarchy].level < currentUserLevel &&
        role !== 'head_admin'
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
      })),
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

    const status = u.verificationStatus || 'pending';
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

    return matchesSearch && matchesStatus && matchesAddress && matchesRole && matchesOnboarding && matchesTime;
  });

  const exportFilteredToCsv = () => {
    if (!filteredUsers.length) {
      toast({ title: "No users to export", description: "Adjust filters to include at least one user.", variant: "destructive" });
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
      if (str.includes("\"") || str.includes(",") || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = filteredUsers.map((u) => [
      escape(u.id),
      escape(u.email),
      escape(u.firstName || ""),
      escape(u.lastName || ""),
      escape(u.role),
      escape(u.verificationStatus || ""),
      escape(u.addressVerified ? "true" : "false"),
      escape(u.onboardingCompleted ? "true" : "false"),
      escape(u.createdAt),
    ].join(","));

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

    toast({ title: "Export started", description: `Exported ${filteredUsers.length} users to CSV.` });
  };

  if (!user || currentUserLevel < 70) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-300">You don't have permission to access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
            <p className="text-gray-300">Manage user roles and permissions</p>
          </div>
          <div className="flex items-center gap-2">
            {isHeadAdmin && (
              <Badge className="bg-purple-500 text-white">
                <Crown className="w-3 h-3 mr-1" />
                Head Admin
              </Badge>
            )}
            {user.role === 'moderator' && (
              <Badge className="bg-blue-500 text-white">
                <Shield className="w-3 h-3 mr-1" />
                Moderator
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-navy-800 border-navy-700 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 min-w-[220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-navy-700 border-navy-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 items-stretch lg:flex-row lg:items-center lg:justify-end">
                {user && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                    <span className="font-semibold text-gray-200">Saved views</span>
                    <Select
                      value={activeViewId || ""}
                      onValueChange={(v: string) => {
                        if (!v) return;
                        applySavedView(v);
                      }}
                    >
                      <SelectTrigger className="w-44 bg-navy-700 border-navy-600 text-white text-xs">
                        <SelectValue placeholder={savedViews.length ? "Choose view" : "No views yet"} />
                      </SelectTrigger>
                      <SelectContent className="bg-navy-700 border-navy-600 text-xs">
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
                      className="border-navy-600 text-gray-200 hover:bg-navy-600"
                      onClick={saveCurrentView}
                    >
                      Save view
                    </Button>
                    {activeViewId && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                          onClick={() => deleteSavedView(activeViewId)}
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500 text-amber-300 hover:bg-amber-500/10"
                          onClick={() => pinSavedView(activeViewId)}
                        >
                          Pin default
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-40 bg-navy-700 border-navy-600 text-white text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600 text-xs">
                    <SelectItem value="all">Status: All</SelectItem>
                    <SelectItem value="verified">Status: Verified</SelectItem>
                    <SelectItem value="pending">Status: Pending</SelectItem>
                    <SelectItem value="suspended">Status: Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={addressFilter} onValueChange={(v: any) => setAddressFilter(v)}>
                  <SelectTrigger className="w-44 bg-navy-700 border-navy-600 text-white text-xs">
                    <SelectValue placeholder="Address" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600 text-xs">
                    <SelectItem value="all">Address: All</SelectItem>
                    <SelectItem value="verified">Address: Verified</SelectItem>
                    <SelectItem value="not_verified">Address: Not Verified</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                  <SelectTrigger className="w-40 bg-navy-700 border-navy-600 text-white text-xs">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600 text-xs">
                    <SelectItem value="all">Role: All</SelectItem>
                    <SelectItem value="contractor">Role: Contractor</SelectItem>
                    <SelectItem value="homeowner">Role: Homeowner</SelectItem>
                    <SelectItem value="business">Role: Business</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={onboardingFilter} onValueChange={(v: any) => setOnboardingFilter(v)}>
                  <SelectTrigger className="w-44 bg-navy-700 border-navy-600 text-white text-xs">
                    <SelectValue placeholder="Onboarding" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600 text-xs">
                    <SelectItem value="all">Onboarding: All</SelectItem>
                    <SelectItem value="complete">Onboarding: Complete</SelectItem>
                    <SelectItem value="pending">Onboarding: Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                  <SelectTrigger className="w-40 bg-navy-700 border-navy-600 text-white text-xs">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600 text-xs">
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
        <Card className="bg-navy-800 border-navy-700">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-white">
                  Users ({filteredUsers.length}{users.length !== filteredUsers.length ? ` of ${users.length}` : ""})
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
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />Verified</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />Pending</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />Suspended</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-700" />Address verified</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-slate-600" />Address not verified</span>
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
                    <TableHead className="text-gray-300">User</TableHead>
                    <TableHead className="text-gray-300">Role</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">Joined</TableHead>
                    <TableHead className="text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user: User) => {
                    const roleInfo = getRoleInfo(user.role);
                    const RoleIcon = roleInfo.icon;
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="text-white">
                            <div className="font-medium">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.email
                              }
                            </div>
                            <div className="text-sm text-gray-400">{user.email}</div>
                            <div className="mt-1 text-xs">
                              <Link
                                href={`/profile/${user.id}`}
                                className="text-orange-400 hover:text-orange-300 hover:underline"
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
                                user.verificationStatus === 'approved'
                                  ? 'bg-emerald-600 text-white'
                                  : user.verificationStatus === 'suspended'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-amber-500/80 text-black'
                              }
                            >
                              {user.verificationStatus === 'approved'
                                ? 'Verified'
                                : user.verificationStatus === 'suspended'
                                ? 'Suspended'
                                : 'Pending verification'}
                            </Badge>
                            <Badge
                              className={
                                user.addressVerified
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-slate-700 text-slate-100'
                              }
                            >
                              {user.addressVerified ? 'Address verified' : 'Address not verified'}
                            </Badge>
                            <Badge variant={user.onboardingCompleted ? "outline" : "secondary"}>
                              {user.onboardingCompleted ? "Onboarding complete" : "Setup pending"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {/* Admin Controls: Grouped and with dropdown for less common actions */}
                          {(currentUserLevel > roleHierarchy[user.role as keyof typeof roleHierarchy]?.level || 
                            (isHeadAdmin && user.role === 'head_admin')) && (
                            <div className="flex flex-wrap gap-2 items-center">
                              {/* Primary Actions */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setUserToEdit(user);
                                  setNewRole(user.role);
                                }}
                                className="border-navy-600 text-gray-300 hover:bg-navy-600"
                                title="Edit user role"
                              >
                                Edit Role
                              </Button>
                              {isHeadAdmin && user.id !== (userToEdit?.id || '') && user.role !== 'head_admin' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    const key = `${user.id}:impersonate`;
                                    setPendingAction((prev) => ({ ...prev, [key]: true }));
                                    try {
                                      const res = await fetch(`/api/admin/impersonate/start/${user.id}`, {
                                        method: "POST",
                                        credentials: "include",
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.message || 'Impersonation failed');
                                      }
                                      toast({ title: 'Impersonation started' });
                                      window.location.reload();
                                    } catch (err: any) {
                                      toast({
                                        title: 'Error',
                                        description: err.message || 'Impersonation failed',
                                        variant: 'destructive',
                                      });
                                      setPendingAction((prev) => ({ ...prev, [key]: false }));
                                    }
                                  }}
                                  className="border-yellow-500 text-yellow-600 hover:bg-yellow-100"
                                  title="Impersonate user"
                                  disabled={pendingAction[`${user.id}:impersonate`]}
                                >
                                  {pendingAction[`${user.id}:impersonate`] ? 'Working…' : 'Impersonate'}
                                </Button>
                              )}
                              {/* Status Controls */}
                              {isHeadAdmin && user.id !== (userToEdit?.id || '') && user.role !== 'head_admin' && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUserControl('suspend', user.id)}
                                    className="border-red-500 text-red-600"
                                    title={user.verificationStatus === 'suspended' ? 'User is already suspended' : 'Suspend user'}
                                    disabled={
                                      pendingAction[`${user.id}:suspend`] || user.verificationStatus === 'suspended'
                                    }
                                  >
                                    {pendingAction[`${user.id}:suspend`] ? 'Working…' : 'Suspend'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUserControl('unsuspend', user.id)}
                                    className="border-green-500 text-green-600"
                                    title="Unsuspend user"
                                    disabled={pendingAction[`${user.id}:unsuspend`]}
                                  >
                                    {pendingAction[`${user.id}:unsuspend`] ? 'Working…' : 'Unsuspend'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUserControl('verify', user.id)}
                                    className="border-blue-500 text-blue-600"
                                    title={user.verificationStatus === 'approved' ? 'User is already verified' : 'Verify user'}
                                    disabled={
                                      pendingAction[`${user.id}:verify`] || user.verificationStatus === 'approved'
                                    }
                                  >
                                    {pendingAction[`${user.id}:verify`] ? 'Working…' : 'Verify'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUserControl('revoke_verify', user.id)}
                                    className="border-gray-500 text-gray-600"
                                    title="Revoke verification"
                                    disabled={pendingAction[`${user.id}:revoke_verify`]}
                                  >
                                    {pendingAction[`${user.id}:revoke_verify`] ? 'Working…' : 'Revoke Verify'}
                                  </Button>
                                </div>
                              )}
                              {/* Role Quick Set Dropdown */}
                              {isHeadAdmin && user.id !== (userToEdit?.id || '') && user.role !== 'head_admin' && (
                                <div className="relative group">
                                  <Button size="sm" variant="outline" className="border-orange-500 text-orange-600 group-hover:bg-orange-50" title="Quick set role">
                                    More
                                  </Button>
                                  <div className="absolute left-0 z-10 hidden group-hover:block bg-navy-700 border border-navy-600 rounded shadow-lg mt-1 min-w-[160px]">
                                    <button onClick={() => handleUserControl('role', user.id, 'contractor_user')} className="block w-full text-left px-4 py-2 text-orange-500 hover:bg-orange-100" disabled={pendingAction[`${user.id}:role:contractor_user`]}> {pendingAction[`${user.id}:role:contractor_user`] ? 'Working…' : 'Set Contractor'} </button>
                                    <button onClick={() => handleUserControl('role', user.id, 'homeowner')} className="block w-full text-left px-4 py-2 text-purple-500 hover:bg-purple-100" disabled={pendingAction[`${user.id}:role:homeowner`]}> {pendingAction[`${user.id}:role:homeowner`] ? 'Working…' : 'Set Homeowner'} </button>
                                  </div>
                                </div>
                              )}
                              {/* (Optional) Delete user button, if ever enabled */}
                              {/* {user.id !== user.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteUser(user.id, user.role)}
                                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
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
          <DialogContent className="bg-navy-800 border-navy-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit User Role</DialogTitle>
              <DialogDescription className="text-gray-300">
                Change the role for {userToEdit?.firstName && userToEdit?.lastName 
                  ? `${userToEdit.firstName} ${userToEdit.lastName}`
                  : userToEdit?.email
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Current Role</Label>
                <div className="mt-1">
                  <Badge className={`${getRoleInfo(userToEdit?.role || '').color} text-white`}>
                    {getRoleInfo(userToEdit?.role || '').label}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-gray-300">New Role</Label>
                <Select value={newRole || undefined} onValueChange={setNewRole}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select new role" />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600">
                    {getAvailableRoles().map((role) => (
                      <SelectItem key={role} value={role} className="text-white">
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
                className="border-navy-600 text-gray-300 hover:bg-navy-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateRole}
                disabled={updateUserRoleMutation.isPending || !newRole}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {updateUserRoleMutation.isPending ? 'Updating...' : 'Update Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}