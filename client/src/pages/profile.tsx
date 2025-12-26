import { memo, useRef, useState } from "react";
import type React from "react";
import { useAuth } from "../hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { uploadObject } from "../lib/objectUpload";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { User, Mail, Phone, MapPin, Bell, Camera } from "lucide-react";

function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    state: user?.state || "",
    zipCode: user?.zipCode || "",
    county: user?.county || "",
    profileImageUrl: user?.profileImageUrl || "",
  });

  const [preferences, setPreferences] = useState(() => {
    const existing = ((user as any)?.preferences || {}) as Record<string, any>;
    return {
      emailDeals: existing.emailDeals ?? true,
      smsUpdates: existing.smsUpdates ?? false,
      weeklyRecommendations: existing.weeklyRecommendations ?? true,
    };
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/user/profile", { ...data, preferences });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { publicUrl } = await uploadObject(file);
      setFormData((prev) => ({ ...prev, profileImageUrl: publicUrl }));
      toast({
        title: "Photo updated",
        description: "Your profile picture was uploaded.",
      });
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      toast({
        title: "Upload failed",
        description: "Could not upload your photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-tsBg text-white pb-20 lg:pb-0">
      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10 space-y-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white mb-1">My Profile</h1>
              <p className="text-sm text-slate-400">
                Manage your personal information and preferences
              </p>
            </div>
          </div>
        </div>

  <Card className="bg-tsCard border border-tsBorder shadow-sm rounded-xl">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg overflow-hidden">
                  {formData.profileImageUrl ? (
                    <img
                      src={formData.profileImageUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      {user?.firstName?.[0]}
                      {user?.lastName?.[0]}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="absolute bottom-0 right-0 h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center border-2 border-tsCard hover:bg-orange-600 transition-colors"
                >
                  <Camera className="h-4 w-4 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelected}
                />
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {user?.firstName} {user?.lastName}
                </h2>
                <div className="space-y-1">
                  <p className="text-slate-300 flex items-center gap-2 justify-center sm:justify-start">
                    <User className="h-4 w-4" />
                    {user?.role || "Homeowner"}
                  </p>
                  {user?.address && (
                    <p className="text-slate-300 flex items-center gap-2 justify-center sm:justify-start">
                      <MapPin className="h-4 w-4" />
                      {user.address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border border-tsBorder shadow-sm rounded-xl">
          <CardHeader className="border-b border-tsBorder pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-base font-medium text-white">
                  Profile Information
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                  Update your personal details
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-6">
            <form onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-white font-medium">
                    First Name
                  </Label>
                    <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-white font-medium">
                    Last Name
                  </Label>
                    <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-white font-medium flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-orange-500" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="text-white font-medium flex items-center gap-2"
                  >
                    <Phone className="h-4 w-4 text-orange-500" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label
                    htmlFor="address"
                    className="text-white font-medium flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4 text-orange-500" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-white font-medium">
                    City
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, city: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-white font-medium">
                    State
                  </Label>
                  <Input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, state: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode" className="text-white font-medium">
                    ZIP Code
                  </Label>
                  <Input
                    id="zipCode"
                    type="text"
                    value={formData.zipCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, zipCode: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="county" className="text-white font-medium">
                    County
                  </Label>
                  <Input
                    id="county"
                    type="text"
                    value={formData.county}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev) => ({ ...prev, county: e.target.value }))
                    }
                    className="bg-tsBg border-tsBorder text-white h-11 focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-tsBorder">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 shadow-lg"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Update Profile"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-tsBorder text-slate-300 hover:bg-tsBg"
                  onClick={() =>
                    setFormData({
                      firstName: user?.firstName || "",
                      lastName: user?.lastName || "",
                      email: user?.email || "",
                      phone: user?.phone || "",
                      address: user?.address || "",
                      city: user?.city || "",
                      state: user?.state || "",
                      zipCode: user?.zipCode || "",
                      county: user?.county || "",
                      profileImageUrl: user?.profileImageUrl || "",
                    })
                  }
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border border-tsBorder shadow-sm rounded-xl">
          <CardHeader className="border-b border-tsBorder pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-base font-medium text-white">
                  Notification Preferences
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                  Manage how you receive updates
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 pb-6">
            <div className="flex items-center justify-between p-4 bg-tsBg rounded-xl border border-tsBorder">
              <div>
                <p className="text-white font-medium">
                  Email notifications for new deals
                </p>
                <p className="text-slate-400 text-sm">
                  Get notified about special offers and deals
                </p>
              </div>
              <Switch
                checked={preferences.emailDeals}
                onCheckedChange={(checked: boolean) =>
                  setPreferences((prev) => ({ ...prev, emailDeals: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-tsBg rounded-xl border border-tsBorder">
              <div>
                <p className="text-white font-medium">
                  SMS notifications for project updates
                </p>
                <p className="text-slate-400 text-sm">
                  Receive text messages about your projects
                </p>
              </div>
              <Switch
                checked={preferences.smsUpdates}
                onCheckedChange={(checked: boolean) =>
                  setPreferences((prev) => ({ ...prev, smsUpdates: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-tsBg rounded-xl border border-tsBorder">
              <div>
                <p className="text-white font-medium">
                  Weekly contractor recommendations
                </p>
                <p className="text-slate-400 text-sm">
                  Get personalized contractor suggestions
                </p>
              </div>
              <Switch
                checked={preferences.weeklyRecommendations}
                onCheckedChange={(checked: boolean) =>
                  setPreferences((prev) => ({ ...prev, weeklyRecommendations: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default memo(Profile);