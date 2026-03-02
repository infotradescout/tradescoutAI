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
      return await apiRequest("POST", "/api/auth/connect-master-admin");
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: "Facebook account connected to your admin account.",
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
      <Card className="w-full max-w-md border-ts-orange/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-ts-orange/20 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-ts-orange" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Connect Admin Account</CardTitle>
          <p className="text-white/70">
            Connect your Facebook login to your master admin account to access admin features.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <Facebook className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium text-white/70">Facebook Account</span>
            </div>
            <p className="text-sm text-white/60">
              You're currently logged in via Facebook. This will connect to your existing master
              admin account.
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <UserCheck className="w-5 h-5 text-ts-orange" />
              <span className="text-sm font-medium text-white/70">Admin Access</span>
            </div>
            <p className="text-sm text-white/60">
              This connects your current Facebook login to your existing admin account.
            </p>
          </div>

          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="w-full bg-ts-orange-dark hover:bg-ts-orange-dark text-white"
            data-testid="button-connect-admin"
          >
            {connectMutation.isPending ? "Connecting..." : "Connect Facebook to Admin Account"}
          </Button>

          <p className="text-xs text-white/60 text-center">
            This will give you full admin dashboard access while keeping your Facebook login.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
