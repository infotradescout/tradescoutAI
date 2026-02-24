import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const [facebookId, setFacebookId] = useState("927070657"); // Pre-filled with your ID
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleEmergencyAccess = async () => {
    try {
      setLoading(true);

      const response = await apiRequest("POST", "/api/auth/emergency-admin-access", {
        facebookId,
      });

      if (response.adminAccess) {
        toast({
          title: "Admin Access Granted",
          description: "You now have full administrative privileges",
        });

        // Redirect to admin dashboard
        setLocation("/admin/users");

        // Refresh the page to update authentication state
        window.location.reload();
      }
    } catch (error: any) {
      toast({
        title: "Access Denied",
        description: error.message || "Emergency admin access failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 py-24">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Master Admin Access</CardTitle>
          <CardDescription>
            Emergency admin login for TradeScout platform management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">Emergency Access</p>
              <p>Use this form to gain immediate admin access to your platform.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="facebook-id">Facebook ID</Label>
            <Input
              id="facebook-id"
              type="text"
              value={facebookId}
              onChange={(e) => setFacebookId(e.target.value)}
              placeholder="Enter your Facebook ID"
              data-testid="input-facebook-id"
            />
            <p className="text-xs text-muted-foreground">Your unique Facebook ID (numbers only)</p>
          </div>

          <Button
            onClick={handleEmergencyAccess}
            disabled={loading || !facebookId}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            data-testid="button-emergency-access"
          >
            {loading ? "Authenticating..." : "Grant Admin Access"}
          </Button>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">Admin Features Available:</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
              <div>• User Management</div>
              <div>• Feature Toggles</div>
              <div>• Role Assignment</div>
              <div>• Platform Settings</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
