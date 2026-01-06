import { memo, useState } from "react";
import {
  Users2,
  Search,
  Filter,
  Edit,
  Trash2,
  Shield,
  Crown,
  Eye,
  Ban,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const ManageUsers = memo(function ManageUsers() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const { toast } = useToast();

  const users = [
    {
      id: 1,
      name: "Mike Johnson",
      email: "mike@johnsonroofing.com",
      role: "contractor_user",
      status: "active",
      verified: true,
      avatar:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
      location: "Los Angeles, CA",
      joinDate: "2024-01-15",
      lastActive: "2024-03-20T10:30:00Z",
      projects: 47,
      rating: 4.8,
    },
    {
      id: 2,
      name: "Jennifer Smith",
      email: "jennifer@email.com",
      role: "homeowner",
      status: "active",
      verified: true,
      avatar:
        "https://images.unsplash.com/photo-1494790108755-2616b612d76c?w=40&h=40&fit=crop&crop=face",
      location: "Orange, CA",
      joinDate: "2024-02-10",
      lastActive: "2024-03-20T09:15:00Z",
      projects: 3,
      rating: null,
    },
    {
      id: 3,
      name: "Sarah Wilson",
      email: "sarah@realtypro.com",
      role: "realtor",
      status: "pending",
      verified: false,
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face",
      location: "San Diego, CA",
      joinDate: "2024-03-18",
      lastActive: "2024-03-19T16:45:00Z",
      projects: 0,
      rating: null,
    },
    {
      id: 4,
      name: "Tom Davis",
      email: "tom@moderator.com",
      role: "moderator",
      status: "active",
      verified: true,
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face",
      location: "Admin",
      joinDate: "2023-12-01",
      lastActive: "2024-03-20T14:20:00Z",
      projects: 0,
      rating: null,
    },
  ];

  const userStats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    pending: users.filter((u) => u.status === "pending").length,
    suspended: users.filter((u) => u.status === "suspended").length,
    contractors: users.filter((u) => u.role === "contractor_user").length,
    homeowners: users.filter((u) => u.role === "homeowner").length,
  };

  const handleUserAction = (userId: number, action: string) => {
    const user = users.find((u) => u.id === userId);
    toast({
      title: `User ${action}`,
      description: `${user?.name} has been ${action.toLowerCase()}.`,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "contractor_user":
        return <Shield className="h-4 w-4 text-blue-400" />;
      case "moderator":
        return <Crown className="h-4 w-4 text-purple-400" />;
      case "super_admin":
        return <Crown className="h-4 w-4 text-red-400" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "contractor_user":
        return "bg-blue-600";
      case "homeowner":
        return "bg-green-600";
      case "realtor":
        return "bg-purple-600";
      case "moderator":
        return "bg-orange-600";
      case "super_admin":
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-400";
      case "pending":
        return "text-yellow-400";
      case "suspended":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && user.status === "active") ||
      (activeTab === "pending" && user.status === "pending") ||
      (activeTab === "suspended" && user.status === "suspended");

    return matchesSearch && matchesRole && matchesTab;
  });

  return (
    <div className="text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Users2 className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-foreground">User Management</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage user accounts, roles, and permissions across the platform
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{userStats.total}</div>
              <div className="text-muted-foreground text-sm">Total Users</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{userStats.active}</div>
              <div className="text-muted-foreground text-sm">Active</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{userStats.pending}</div>
              <div className="text-muted-foreground text-sm">Pending</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{userStats.suspended}</div>
              <div className="text-muted-foreground text-sm">Suspended</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{userStats.contractors}</div>
              <div className="text-muted-foreground text-sm">Contractors</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{userStats.homeowners}</div>
              <div className="text-muted-foreground text-sm">Homeowners</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background border-input text-foreground"
                  />
                </div>
              </div>

              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-48 bg-background border-input text-foreground">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="homeowner">Homeowners</SelectItem>
                  <SelectItem value="contractor_user">Contractors</SelectItem>
                  <SelectItem value="realtor">Realtors</SelectItem>
                  <SelectItem value="moderator">Moderators</SelectItem>
                  <SelectItem value="super_admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* User Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted border-border">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary">
              All Users ({userStats.total})
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-primary">
              Active ({userStats.active})
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-primary">
              Pending ({userStats.pending})
            </TabsTrigger>
            <TabsTrigger value="suspended" className="data-[state=active]:bg-primary">
              Suspended ({userStats.suspended})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium">{user.name}</h3>
                          {user.verified && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                          {getRoleIcon(user.role)}
                        </div>
                        <p className="text-gray-400 text-sm">{user.email}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role.replace("_", " ").toUpperCase()}
                          </Badge>
                          <span className={`text-sm ${getStatusColor(user.status)}`}>
                            {user.status.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-sm">{user.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-white font-medium">
                          {user.projects}{" "}
                          {user.role === "contractor_user" ? "Projects" : "Requests"}
                        </div>
                        {user.rating && (
                          <div className="text-gray-400 text-sm">★ {user.rating} rating</div>
                        )}
                        <div className="text-gray-400 text-sm">
                          Joined {new Date(user.joinDate).toLocaleDateString()}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-orange-600 text-orange-400 hover:bg-orange-600/20"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleUserAction(user.id, "Viewed")}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUserAction(user.id, "Edited")}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          {user.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => handleUserAction(user.id, "Suspended")}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleUserAction(user.id, "Activated")}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Activate User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleUserAction(user.id, "Deleted")}
                            className="text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredUsers.length === 0 && (
              <EmptyState
                icon={Users2}
                title="No Users Found"
                description={
                  searchQuery || selectedRole !== "all"
                    ? "No users match your current filters"
                    : "No users found in this category"
                }
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default ManageUsers;
