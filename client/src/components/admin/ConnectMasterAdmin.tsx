import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Facebook, UserCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ConnectMasterAdmin() {
  const { toast } = useToast();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/connect-master-admin");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to connect admin account");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: "Facebook account connected to master admin. You now have full admin access.",
      });
      // Refresh the page to update auth state
      setTimeout(() => {
        window.location.href = "/scout";
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="gradient-bg flex items-center justify-center p-4 py-24">
      <Card className="w-full max-w-md border-orange-500/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-orange-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Connect Admin Account</CardTitle>
          <p className="text-slate-300">
            Connect your Facebook login to your master admin account to access admin features.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <Facebook className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium text-slate-300">Facebook Account</span>
            </div>
            <p className="text-sm text-slate-400">
              You're currently logged in via Facebook. This will connect to your existing master
              admin account.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <UserCheck className="w-5 h-5 text-orange-400" />
              <span className="text-sm font-medium text-slate-300">Master Admin Access</span>
            </div>
            <p className="text-sm text-slate-400">
              Connect to: mrplatypus4777@gmail.com
              <br />
              Role: Super Admin
            </p>
          </div>

          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-connect-admin"
          >
            {connectMutation.isPending ? "Connecting..." : "Connect Facebook to Admin Account"}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            This will give you full admin dashboard access while keeping your Facebook login.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
