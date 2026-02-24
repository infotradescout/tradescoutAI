import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  UserPlus,
  Edit,
  Shield,
  Users,
  Crown,
  Eye,
  Building,
  Wrench,
  Car,
  Home,
  User,
  MoreHorizontal,
  UtensilsCrossed,
  Truck,
  Wine,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
  activeRole: string;
  profileImageUrl: string | null;
  emailVerified: boolean;
  addressVerified: boolean;
  createdAt: string;
  facebookId: string | null;
}

const AVAILABLE_ROLES = [
  { value: "homeowner", label: "Homeowner", icon: Home, color: "bg-blue-500" },
  { value: "contractor_user", label: "Contractor", icon: Wrench, color: "bg-orange-500" },
  { value: "realtor", label: "Realtor", icon: Building, color: "bg-green-500" },
  { value: "car_salesman", label: "Car Salesman", icon: Car, color: "bg-purple-500" },
  { value: "business_owner", label: "Business Owner", icon: Building, color: "bg-amber-500" },
  {
    value: "restaurant_owner",
    label: "Restaurant Owner",
    icon: UtensilsCrossed,
    color: "bg-orange-500",
  },
  { value: "food_truck_owner", label: "Food Truck Owner", icon: Truck, color: "bg-orange-500" },
  { value: "bar_owner", label: "Bar / Lounge Owner", icon: Wine, color: "bg-purple-600" },
  { value: "helper", label: "Helper", icon: Users, color: "bg-cyan-500" },
  { value: "moderator", label: "Moderator", icon: Shield, color: "bg-yellow-500" },
  { value: "ops_admin", label: "Admin", icon: Eye, color: "bg-red-500" },
  {
    value: "super_admin",
    label: "Super Admin",
    icon: Crown,
    color: "bg-gradient-to-r from-yellow-400 to-red-500",
  },
];

const ROLE_HIERARCHY = {
  homeowner: 1,
  helper: 2,
  contractor_user: 3,
  realtor: 4,
  car_salesman: 4,
  business_owner: 4,
  restaurant_owner: 4,
  food_truck_owner: 4,
  bar_owner: 4,
  moderator: 5,
  ops_admin: 6,
  super_admin: 7,
};

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingRoles, setEditingRoles] = useState<string[]>([]);
  const [newActiveRole, setNewActiveRole] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "homeowner",
    password: "",
    sendEmail: true,
  });
  const { toast } = useToast();

  const CREATE_USER_ROLES = [
    { value: "homeowner", label: "Homeowner" },
    { value: "contractor", label: "Contractor" },
    { value: "realtor", label: "Realtor" },
    { value: "car_dealer", label: "Car Dealer" },
    { value: "business_owner", label: "Business Owner" },
    { value: "restaurant_owner", label: "Restaurant Owner" },
    { value: "food_truck_owner", label: "Food Truck Owner" },
    { value: "bar_owner", label: "Bar / Lounge Owner" },
    { value: "handyman", label: "Helper" },
  ];

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const updateUserRoles = useMutation({
    mutationFn: async ({
      userId,
      roles,
      activeRole,
    }: {
      userId: string;
      roles: string[];
      activeRole: string;
    }) => {
      return apiRequest(`/api/admin/users/${userId}/roles`, {
        method: "PATCH",
        body: { roles, activeRole },
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Roles Updated",
        description: `Successfully updated user roles`,
      });
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const impersonateUser = useMutation({
    mutationFn: async (userId: string) => {
      const reason = window.prompt("Enter impersonation reason (min 5 characters):")?.trim();

      if (!reason || reason.length < 5) {
        throw new Error("Impersonation requires a reason of at least 5 characters.");
      }

      return apiRequest(`/api/admin/users/${userId}/impersonate`, {
        method: "POST",
        body: { reason },
      });
    },
    onSuccess: () => {
      toast({
        title: "Impersonation Active",
        description: "You are now viewing the platform as this user",
      });
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error) => {
      toast({
        title: "Impersonation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createUser = useMutation({
    mutationFn: async (payload: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      password?: string;
      sendEmail: boolean;
    }) => {
      return apiRequest("/api/admin/users/provision", {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Created",
        description: "The account was provisioned successfully.",
      });
      setCreateDialogOpen(false);
      setCreateUserForm({
        firstName: "",
        lastName: "",
        email: "",
        role: "homeowner",
        password: "",
        sendEmail: true,
      });
    },
    onError: (error) => {
      toast({
        title: "Create User Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.roles?.some((role) => role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleInfo = (roleName: string) => {
    return (
      AVAILABLE_ROLES.find((role) => role.value === roleName) || {
        value: roleName,
        label: roleName,
        icon: User,
        color: "bg-gray-500",
      }
    );
  };

  const handleRoleToggle = (role: string) => {
    if (editingRoles.includes(role)) {
      setEditingRoles((prev) => prev.filter((r) => r !== role));
    } else {
      setEditingRoles((prev) => [...prev, role]);
    }
  };

  const handleSaveRoles = () => {
    if (selectedUser && editingRoles.length > 0) {
      const activeRole = newActiveRole || editingRoles[0];
      updateUserRoles.mutate({
        userId: selectedUser.id,
        roles: editingRoles,
        activeRole,
      });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditingRoles(user.roles || [user.role]);
    setNewActiveRole(user.activeRole || user.role);
  };

  const handleCreateUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = createUserForm.email.trim().toLowerCase();
    if (!email) {
      toast({
        title: "Email Required",
        description: "Enter an email address to create the account.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      email,
      role: createUserForm.role,
      firstName: createUserForm.firstName.trim(),
      lastName: createUserForm.lastName.trim(),
      sendEmail: createUserForm.sendEmail,
      ...(createUserForm.password.trim() ? { password: createUserForm.password.trim() } : {}),
    };

    createUser.mutate(payload);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse">Loading users...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts, assign multiple roles, and control access levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search users by email, name, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-user-search"
              />
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              Showing {filteredUsers.length} of {users.length} users
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-user">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateUser}>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={createUserForm.firstName}
                      onChange={(event) =>
                        setCreateUserForm((prev) => ({ ...prev, firstName: event.target.value }))
                      }
                      placeholder="First name"
                      data-testid="input-create-user-first-name"
                    />
                    <Input
                      value={createUserForm.lastName}
                      onChange={(event) =>
                        setCreateUserForm((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                      placeholder="Last name"
                      data-testid="input-create-user-last-name"
                    />
                  </div>

                  <Input
                    type="email"
                    value={createUserForm.email}
                    onChange={(event) =>
                      setCreateUserForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="user@example.com"
                    data-testid="input-create-user-email"
                    required
                  />

                  <Select
                    value={createUserForm.role}
                    onValueChange={(value) =>
                      setCreateUserForm((prev) => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger data-testid="select-create-user-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATE_USER_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="password"
                    value={createUserForm.password}
                    onChange={(event) =>
                      setCreateUserForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    placeholder="Leave blank to send set-password link"
                    data-testid="input-create-user-password"
                  />

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={createUserForm.sendEmail}
                      onCheckedChange={(checked) =>
                        setCreateUserForm((prev) => ({ ...prev, sendEmail: checked === true }))
                      }
                      data-testid="checkbox-create-user-send-email"
                    />
                    Send account setup email
                  </label>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createUser.isPending}>
                      {createUser.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Active Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: User) => {
                  const userRoles = user.roles || [user.role];
                  const activeRoleInfo = getRoleInfo(user.activeRole || user.role);

                  return (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt="Profile"
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userRoles.map((role) => {
                            const roleInfo = getRoleInfo(role);
                            const Icon = roleInfo.icon;
                            return (
                              <Badge
                                key={role}
                                variant="secondary"
                                className={`${roleInfo.color} text-white text-xs`}
                              >
                                <Icon className="w-3 h-3 mr-1" />
                                {roleInfo.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${activeRoleInfo.color} text-white`}>
                          <activeRoleInfo.icon className="w-3 h-3 mr-1" />
                          {activeRoleInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.emailVerified && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Email ✓
                            </Badge>
                          )}
                          {user.addressVerified && (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              Address ✓
                            </Badge>
                          )}
                          {user.facebookId && (
                            <Badge variant="outline" className="text-blue-800 border-blue-800">
                              Facebook
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => impersonateUser.mutate(user.id)}
                            data-testid={`button-impersonate-${user.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Roles Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                {selectedUser.profileImageUrl ? (
                  <img
                    src={selectedUser.profileImageUrl}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-medium">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <Tabs defaultValue="roles" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="roles">Assign Roles</TabsTrigger>
                  <TabsTrigger value="dashboard">Dashboard Switch</TabsTrigger>
                </TabsList>

                <TabsContent value="roles" className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Available Roles</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {AVAILABLE_ROLES.map((role) => {
                        const Icon = role.icon;
                        const isSelected = editingRoles.includes(role.value);
                        return (
                          <div
                            key={role.value}
                            className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border hover:border-primary/50"
                            }`}
                            onClick={() => handleRoleToggle(role.value)}
                          >
                            <Checkbox
                              checked={isSelected}
                              data-testid={`checkbox-role-${role.value}`}
                            />
                            <div
                              className={`w-8 h-8 rounded ${role.color} flex items-center justify-center`}
                            >
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="font-medium">{role.label}</div>
                              <div className="text-xs text-muted-foreground">
                                Level{" "}
                                {ROLE_HIERARCHY[role.value as keyof typeof ROLE_HIERARCHY] || 1}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {editingRoles.length > 1 && (
                    <div>
                      <h4 className="font-medium mb-3">Default Active Role</h4>
                      <Select value={newActiveRole} onValueChange={setNewActiveRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select primary role" />
                        </SelectTrigger>
                        <SelectContent>
                          {editingRoles.map((role) => {
                            const roleInfo = getRoleInfo(role);
                            const Icon = roleInfo.icon;
                            return (
                              <SelectItem key={role} value={role}>
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4" />
                                  {roleInfo.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="dashboard">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Users with multiple roles can switch between different dashboard views
                      seamlessly.
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {editingRoles.map((role) => {
                        const roleInfo = getRoleInfo(role);
                        const Icon = roleInfo.icon;
                        return (
                          <div
                            key={role}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded ${roleInfo.color} flex items-center justify-center`}
                              >
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <div className="font-medium">{roleInfo.label} Dashboard</div>
                                <div className="text-xs text-muted-foreground">
                                  Role-specific interface and features
                                </div>
                              </div>
                            </div>
                            <Badge variant={newActiveRole === role ? "default" : "secondary"}>
                              {newActiveRole === role ? "Default" : "Available"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveRoles}
                  disabled={editingRoles.length === 0 || updateUserRoles.isPending}
                  data-testid="button-save-roles"
                >
                  {updateUserRoles.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
