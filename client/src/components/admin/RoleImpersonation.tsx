import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCog, Eye, ArrowLeft, Shield, AlertTriangle, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImpersonationState {
  isImpersonating: boolean;
  originalRole: string;
  currentRole: string;
  targetUserId?: string;
}

const AVAILABLE_ROLES = [
  { id: "homeowner", name: "Homeowner", description: "Regular homeowner account" },
  { id: "contractor_user", name: "Contractor", description: "Verified contractor account" },
  {
    id: "accelerator_member",
    name: "Verified Contractor",
    description: "Contractor role with standard trust-governed access",
  },
  { id: "moderator", name: "Moderator", description: "Community moderation permissions" },
  { id: "ops_admin", name: "Operations Admin", description: "Operational admin access" },
];

export function RoleImpersonation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState("");
  const [impersonationState, setImpersonationState] = useState<ImpersonationState>({
    isImpersonating: false,
    originalRole: user?.role || "homeowner",
    currentRole: user?.role || "homeowner",
  });

  // Check if user has admin permissions
  const canImpersonate = user?.role === "super_admin" || user?.role === "ops_admin";

  // Start impersonation mutation
  const startImpersonationMutation = useMutation({
    mutationFn: async ({ role }: { role: string }) => {
      return apiRequest("POST", "/api/admin/impersonate", { role });
    },
    onSuccess: (data) => {
      setImpersonationState({
        isImpersonating: true,
        originalRole: user?.role || "homeowner",
        currentRole: selectedRole,
        targetUserId: data.userId,
      });

      // Invalidate auth queries to refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      toast({
        title: "Impersonation Started",
        description: `Now viewing site as ${AVAILABLE_ROLES.find((r) => r.id === selectedRole)?.name}`,
      });

      // Refresh the page to apply new permissions
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: "Impersonation Failed",
        description: "Could not start role impersonation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stop impersonation mutation
  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/stop-impersonation");
    },
    onSuccess: () => {
      setImpersonationState({
        isImpersonating: false,
        originalRole: impersonationState.originalRole,
        currentRole: impersonationState.originalRole,
      });

      // Invalidate auth queries to refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      toast({
        title: "Impersonation Stopped",
        description: "Returned to your original admin role",
      });

      // Refresh the page to restore original permissions
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Could not stop impersonation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartImpersonation = () => {
    if (!selectedRole) {
      toast({
        title: "No Role Selected",
        description: "Please select a role to impersonate",
        variant: "destructive",
      });
      return;
    }
    startImpersonationMutation.mutate({ role: selectedRole });
  };

  const handleStopImpersonation = () => {
    stopImpersonationMutation.mutate();
  };

  if (!canImpersonate) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-gray-400">
            <Shield className="h-5 w-5" />
            <span>Role impersonation requires admin privileges</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <UserCog className="h-5 w-5 mr-2 text-orange-500" />
          Role Impersonation
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Test platform functionality from different user perspectives
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-white font-medium">Current Role:</span>
              <Badge
                className={impersonationState.isImpersonating ? "bg-orange-500" : "bg-blue-500"}
              >
                {AVAILABLE_ROLES.find((r) => r.id === impersonationState.currentRole)?.name ||
                  impersonationState.currentRole}
              </Badge>
            </div>
            {impersonationState.isImpersonating && (
              <p className="text-sm text-gray-400 mt-1">
                Original role:{" "}
                {AVAILABLE_ROLES.find((r) => r.id === impersonationState.originalRole)?.name}
              </p>
            )}
          </div>

          {impersonationState.isImpersonating && (
            <Button
              onClick={handleStopImpersonation}
              disabled={stopImpersonationMutation.isPending}
              variant="outline"
              size="sm"
              className="border-red-500 text-red-400 hover:bg-red-500/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Stop Impersonation
            </Button>
          )}
        </div>

        {/* Impersonation Warning */}
        {impersonationState.isImpersonating && (
          <Alert className="border-orange-500/50 bg-orange-500/10">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-300">
              You are currently impersonating a{" "}
              {AVAILABLE_ROLES.find((r) => r.id === impersonationState.currentRole)?.name} role. All
              actions will be performed with that role's permissions.
            </AlertDescription>
          </Alert>
        )}

        {/* Role Selection */}
        {!impersonationState.isImpersonating && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Select Role to Impersonate
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Choose a role to test..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {AVAILABLE_ROLES.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div>
                        <div className="font-medium">{role.name}</div>
                        <div className="text-sm text-gray-400">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleStartImpersonation}
              disabled={!selectedRole || startImpersonationMutation.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              <Eye className="h-4 w-4 mr-2" />
              {startImpersonationMutation.isPending ? "Starting..." : "Start Impersonation"}
            </Button>
          </div>
        )}

        {/* Info Box */}
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-300 text-sm">
            <strong>Testing Tips:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Navigation menus will update based on the selected role</li>
              <li>Feature access will be restricted according to role permissions</li>
              <li>Dashboard content will reflect the impersonated role's view</li>
              <li>All database actions will be logged under your admin account</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
