import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge, RoleHierarchy, PermissionIndicator } from "@/components/ui/RoleBadge";
import { TradeBadge, TradeCategoryHeader } from "@/components/ui/TradeBadge";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  getRoleDisplayName, 
  getTradeDisplayName,
  getRolePermissions,
  getRoleHierarchyLevel,
  canUserPerformAction,
  ROLE_CATEGORIES,
  TRADE_CATEGORIES
} from "@shared/roles";
import type { UserRole, TradeCategory } from "@shared/roles";
import { Users, Shield, Settings, Eye } from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: string;
  profileImageUrl?: string;
}

interface UserRoleManagerProps {
  user: User;
  canEdit?: boolean;
}

export function UserRoleManager({ user, canEdit = false }: UserRoleManagerProps) {
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role Updated",
        description: `User role changed to ${getRoleDisplayName(selectedRole)}`,
      });
      setIsChangeRoleOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = () => {
    if (!currentUser) return;
    
    const currentUserRole = currentUser.role as UserRole;
    if (!canUserPerformAction(currentUserRole, user.role as UserRole, 'canManageRoles')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to change this user's role",
        variant: "destructive",
      });
      return;
    }

    changeRoleMutation.mutate({ userId: user.id, newRole: selectedRole });
  };

  const userPermissions = getRolePermissions(user.role as UserRole);
  const userHierarchyLevel = getRoleHierarchyLevel(user.role as UserRole);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {user.firstName} {user.lastName}
          </span>
          <div className="flex items-center gap-2">
            <RoleBadge role={user.role as UserRole} />
            {canEdit && (
              <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Change Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Change User Role</DialogTitle>
                    <DialogDescription>
                      Select a new role for {user.firstName} {user.lastName}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Current Role</h4>
                      <div className="space-y-2">
                        <RoleBadge role={user.role as UserRole} size="lg" />
                        <RoleHierarchy role={user.role as UserRole} showLevel />
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-3">New Role</h4>
                      <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_CATEGORIES).map(([category, roles]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground capitalize">
                                {category.replace('_', ' ')} Roles
                              </div>
                              {roles.map((role) => (
                                <SelectItem key={role} value={role}>
                                  <div className="flex items-center gap-2">
                                    <RoleBadge role={role as UserRole} size="sm" />
                                  </div>
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedRole && (
                        <div className="mt-2 space-y-2">
                          <RoleBadge role={selectedRole} size="lg" />
                          <RoleHierarchy role={selectedRole} showLevel />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsChangeRoleOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleRoleChange}
                      disabled={changeRoleMutation.isPending || selectedRole === user.role}
                    >
                      {changeRoleMutation.isPending ? "Updating..." : "Update Role"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          {user.email} • Member since {new Date(user.createdAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Role Information */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Role</p>
              <RoleBadge role={user.role as UserRole} size="lg" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Hierarchy Level</p>
              <RoleHierarchy role={user.role as UserRole} showLevel />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Permissions
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(userPermissions).map(([permission, hasPermission]) => (
              <PermissionIndicator
                key={permission}
                hasPermission={hasPermission}
                permissionName={permission.replace(/([A-Z])/g, ' $1').toLowerCase()}
                size="sm"
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Trade category selection component for contractors
interface TradeSelectionProps {
  selectedTrades: TradeCategory[];
  onTradesChange: (trades: TradeCategory[]) => void;
  maxSelections?: number;
}

export function TradeSelection({ 
  selectedTrades, 
  onTradesChange, 
  maxSelections = 5 
}: TradeSelectionProps) {
  const handleTradeToggle = (trade: TradeCategory) => {
    if (selectedTrades.includes(trade)) {
      onTradesChange(selectedTrades.filter(t => t !== trade));
    } else if (selectedTrades.length < maxSelections) {
      onTradesChange([...selectedTrades, trade]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select Your Trade Specializations</h3>
        <Badge variant="secondary">
          {selectedTrades.length} / {maxSelections} selected
        </Badge>
      </div>
      
      {Object.entries(TRADE_CATEGORIES).map(([category, trades]) => (
        <div key={category}>
          <TradeCategoryHeader 
            category={category as keyof typeof TRADE_CATEGORIES} 
            trades={[...trades] as TradeCategory[]} 
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {trades.map((trade) => (
              <Button
                key={trade}
                variant={selectedTrades.includes(trade as TradeCategory) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTradeToggle(trade as TradeCategory)}
                disabled={!selectedTrades.includes(trade as TradeCategory) && selectedTrades.length >= maxSelections}
              >
                <TradeBadge trade={trade as TradeCategory} showIcon={false} size="sm" />
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}