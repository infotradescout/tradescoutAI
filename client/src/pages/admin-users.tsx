// Minimal user controls for super admin
import { useState } from "react";
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
  onboardingCompleted: boolean;
  createdAt: string;
};

const roleHierarchy = {
  'head_admin': { level: 100, label: 'Head Admin', icon: Crown, color: 'bg-purple-500' },
  'moderator': { level: 80, label: 'Moderator', icon: Shield, color: 'bg-blue-500' },
  'ops_admin': { level: 70, label: 'Operations Admin', icon: UserCog, color: 'bg-green-500' },
  'contractor_user': { level: 20, label: 'Contractor', icon: Users, color: 'bg-orange-500' },
  'accelerator_member': { level: 15, label: 'Accelerator Member', icon: Users, color: 'bg-yellow-500' },
  'homeowner': { level: 10, label: 'Homeowner', icon: Users, color: 'bg-slate-900/60' },
};

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  // Pending state for each user action (by userId + action)
  const [pendingAction, setPendingAction] = useState<{ [key: string]: boolean }>({});

  // Check if current user is head admin
  const isHeadAdmin = user?.role === 'head_admin';
  const currentUserLevel = roleHierarchy[user?.role as keyof typeof roleHierarchy]?.level || 0;

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users", searchTerm, selectedRole],
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
      window.location.reload();
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
            <div className="flex gap-4">
              <div className="flex-1">
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
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-48 bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600">
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(roleHierarchy).map(([role, info]) => (
                    <SelectItem key={role} value={role} className="text-white">
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-navy-800 border-navy-700">
          <CardHeader>
            <CardTitle className="text-white">Users ({users.length})</CardTitle>
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
                  {users.map((user: User) => {
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
                          <Badge className={`${roleInfo.color} text-white`}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {roleInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.onboardingCompleted ? "default" : "secondary"}>
                            {user.onboardingCompleted ? "Active" : "Setup Pending"}
                          </Badge>
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
                                  <Button size="sm" variant="outline" onClick={() => handleUserControl('suspend', user.id)} className="border-red-500 text-red-600" title="Suspend user" disabled={pendingAction[`${user.id}:suspend`]}> {pendingAction[`${user.id}:suspend`] ? 'Working…' : 'Suspend'} </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleUserControl('unsuspend', user.id)} className="border-green-500 text-green-600" title="Unsuspend user" disabled={pendingAction[`${user.id}:unsuspend`]}> {pendingAction[`${user.id}:unsuspend`] ? 'Working…' : 'Unsuspend'} </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleUserControl('verify', user.id)} className="border-blue-500 text-blue-600" title="Verify user" disabled={pendingAction[`${user.id}:verify`]}> {pendingAction[`${user.id}:verify`] ? 'Working…' : 'Verify'} </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleUserControl('revoke_verify', user.id)} className="border-gray-500 text-gray-600" title="Revoke verification" disabled={pendingAction[`${user.id}:revoke_verify`]}> {pendingAction[`${user.id}:revoke_verify`] ? 'Working…' : 'Revoke Verify'} </Button>
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