import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, User } from "lucide-react";
import { getRoleUiConfig, getRoleDashboardPath } from "@/lib/roleUiConfig";

export default function RoleSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState(user?.activeRole || user?.role);

  const switchRole = useMutation({
    mutationFn: async (newRole: string) => {
      return apiRequest("/api/auth/switch-role", {
        method: "POST",
        body: { role: newRole },
      });
    },
    onSuccess: (data, newRole) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      const roleConfig = getRoleUiConfig(newRole);
      toast({
        title: "Role Switched",
        description: `Now viewing as ${roleConfig?.label || newRole}`,
      });

      // Navigate to role-specific dashboard
      const dashboard = getRoleDashboardPath(newRole) || "/scout";
      if (dashboard) {
        setTimeout(() => {
          window.location.href = dashboard;
        }, 500);
      } else {
        setTimeout(() => window.location.reload(), 500);
      }
    },
    onError: (error) => {
      toast({
        title: "Switch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const currentRole = user?.activeRole || user?.role;

  if (!user || userRoles.length <= 1) {
    return null; // Don't show if user has only one role
  }

  const handleRoleSwitch = () => {
    if (selectedRole && selectedRole !== currentRole) {
      switchRole.mutate(selectedRole);
    }
  };

  const getCurrentRoleInfo = () => {
    const roleConfig = currentRole ? getRoleUiConfig(currentRole) : {};
    return {
      label: roleConfig.label || currentRole,
      icon: roleConfig.icon || User,
      color: roleConfig.color || "bg-white/10",
    };
  };

  const currentRoleInfo = getCurrentRoleInfo();
  const CurrentIcon = currentRoleInfo.icon;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="w-5 h-5" />
          Role Switcher
        </CardTitle>
        <CardDescription>
          You have multiple roles. Switch to access different dashboards and features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Role Display */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${currentRoleInfo.color} flex items-center justify-center`}
            >
              <CurrentIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">Current Role</div>
              <div className="text-sm text-muted-foreground">{currentRoleInfo.label}</div>
            </div>
          </div>
          <Badge className={`${currentRoleInfo.color} text-white`}>Active</Badge>
        </div>

        {/* Available Roles */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Your Available Roles</h4>
          <div className="grid grid-cols-1 gap-2">
            {userRoles.map((role: string) => {
              const roleConfig = getRoleUiConfig(role);
              const Icon = roleConfig.icon || User;
              const isActive = role === currentRole;

              return (
                <div
                  key={role}
                  className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border hover:border-primary/50 cursor-pointer"
                  }`}
                  onClick={() => !isActive && setSelectedRole(role)}
                >
                  <div
                    className={`w-8 h-8 rounded ${roleConfig.color || "bg-white/10"} flex items-center justify-center`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{roleConfig.label || role}</div>
                    <div className="text-xs text-muted-foreground">
                      {isActive ? "Currently active" : "Click to select"}
                    </div>
                  </div>
                  {isActive && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Role Selection Dropdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="flex-1" data-testid="select-role">
                <SelectValue placeholder="Select a role to switch to" />
              </SelectTrigger>
              <SelectContent>
                {userRoles.map((role: string) => {
                  const roleConfig = getRoleUiConfig(role);
                  const Icon = roleConfig.icon || User;
                  return (
                    <SelectItem key={role} value={role} disabled={role === currentRole}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {roleConfig.label || role}
                        {role === currentRole && <span className="text-xs">(Current)</span>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              onClick={handleRoleSwitch}
              disabled={!selectedRole || selectedRole === currentRole || switchRole.isPending}
              data-testid="button-switch-role"
            >
              {switchRole.isPending ? "Switching..." : "Switch"}
            </Button>
          </div>
        </div>

        {/* Dashboard Preview */}
        {selectedRole && selectedRole !== currentRole && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="text-sm font-medium text-primary mb-1">
              Switching to: {getRoleUiConfig(selectedRole).label || selectedRole}
            </div>
            <div className="text-xs text-muted-foreground">
              You'll be redirected to the {getRoleUiConfig(selectedRole).label || selectedRole}{" "}
              dashboard
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
