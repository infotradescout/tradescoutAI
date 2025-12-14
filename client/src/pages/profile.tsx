import { memo, useRef, useState } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Mail, Phone, MapPin, Bell, Clock, Camera } from "lucide-react";

const Profile = memo(function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    zipCode: user?.zipCode || '',
    county: user?.county || '',
    profileImageUrl: user?.profileImageUrl || ''
  });

  const [preferences, setPreferences] = useState({
    emailDeals: true,
    smsUpdates: false,
    weeklyRecommendations: true
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('PUT', '/api/user/profile', { ...data, preferences });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Profile Updated!",
        description: "Your profile information has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleUploadClick = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { uploadURL } = await apiRequest('POST', '/api/objects/upload');

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      const stableUrl = typeof uploadURL === 'string' ? uploadURL.split('?')[0] : '';
      setFormData((prev) => ({ ...prev, profileImageUrl: stableUrl || uploadURL }));
      toast({ title: 'Photo updated', description: 'Your profile picture was uploaded.' });
    } catch (error) {
      console.error('Profile photo upload failed:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload your photo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-white pb-20 lg:pb-0">
      <div className="container mx-auto px-4 py-6 lg:py-10">
        <div className="max-w-5xl mx-auto">
          {/* Modern Header */}
          <div className="mb-8 lg:mb-12">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-5xl font-bold text-white mb-1">My Profile</h1>
                <p className="text-lg text-slate-400">
                  Manage your personal information and preferences
                </p>
              </div>
            </div>
          </div>

          {/* Profile Header Card */}
          <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg overflow-hidden">
                    {formData.profileImageUrl ? (
                      <img src={formData.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <>{user?.firstName?.[0]}{user?.lastName?.[0]}</>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="absolute bottom-0 right-0 h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center border-2 border-[#1a2332] hover:bg-orange-600 transition-colors"
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
                      {user?.role || 'Homeowner'} • Member since {new Date(user?.createdAt || Date.now()).getFullYear()}
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

          {/* Profile Information Form */}
          <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl mb-8">
            <CardHeader className="border-b border-[#2d3748] pb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Profile Information</CardTitle>
                  <p className="text-sm text-slate-400 mt-1">Update your personal details</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
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
                      onChange={handleChange('firstName')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="Enter first name"
                      data-testid="input-firstName"
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
                      onChange={handleChange('lastName')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="Enter last name"
                      data-testid="input-lastName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-orange-500" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange('email')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="email@example.com"
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4 text-orange-500" />
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange('phone')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="(555) 123-4567"
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="address" className="text-white font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-500" />
                      Address
                    </Label>
                    <Input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={handleChange('address')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="123 Main St, Los Angeles, CA 90210"
                      data-testid="input-address"
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
                      onChange={handleChange('city')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="Los Angeles"
                      data-testid="input-city"
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
                      onChange={handleChange('state')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="CA"
                      data-testid="input-state"
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
                      onChange={handleChange('zipCode')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="90210"
                      data-testid="input-zipCode"
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
                      onChange={handleChange('county')}
                      className="bg-[#0f1419] border-[#2d3748] text-white h-11 focus:border-orange-500 transition-colors"
                      placeholder="Los Angeles County"
                      data-testid="input-county"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[#2d3748]">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 shadow-lg"
                    data-testid="button-updateProfile"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Update Profile'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]"
                    onClick={() => setFormData({
                      firstName: user?.firstName || '',
                      lastName: user?.lastName || '',
                      email: user?.email || '',
                      phone: user?.phone || '',
                      address: user?.address || '',
                      city: user?.city || '',
                      state: user?.state || '',
                      zipCode: user?.zipCode || '',
                      county: user?.county || '',
                      profileImageUrl: user?.profileImageUrl || ''
                    })}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl mb-8">
            <CardHeader className="border-b border-[#2d3748] pb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Notification Preferences</CardTitle>
                  <p className="text-sm text-slate-400 mt-1">Manage how you receive updates</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between p-4 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                <div>
                  <p className="text-white font-medium">Email notifications for new deals</p>
                  <p className="text-slate-400 text-sm">Get notified about special offers and deals</p>
                </div>
                <Switch
                  checked={preferences.emailDeals}
                  onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, emailDeals: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                <div>
                  <p className="text-white font-medium">SMS notifications for project updates</p>
                  <p className="text-slate-400 text-sm">Receive text messages about your projects</p>
                </div>
                <Switch
                  checked={preferences.smsUpdates}
                  onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, smsUpdates: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-[#0f1419] rounded-xl border border-[#2d3748]">
                <div>
                  <p className="text-white font-medium">Weekly contractor recommendations</p>
                  <p className="text-slate-400 text-sm">Get personalized contractor suggestions</p>
                </div>
                <Switch
                  checked={preferences.weeklyRecommendations}
                  onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, weeklyRecommendations: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
            <CardHeader className="border-b border-[#2d3748] pb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Recent Activity</CardTitle>
                  <p className="text-sm text-slate-400 mt-1">Your latest actions on TradeScout</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="bg-[#0f1419] p-4 rounded-xl border border-[#2d3748] hover:border-orange-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white mb-1">Requested quote for kitchen renovation</h3>
                    <p className="text-slate-400 text-sm">2 days ago</p>
                  </div>
                  <span className="text-yellow-400 text-sm font-medium bg-yellow-400/10 px-3 py-1 rounded-full">
                    Pending
                  </span>
                </div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-xl border border-[#2d3748] hover:border-orange-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white mb-1">Contacted ABC Plumbing for bathroom repair</h3>
                    <p className="text-slate-400 text-sm">1 week ago</p>
                  </div>
                  <span className="text-green-400 text-sm font-medium bg-green-400/10 px-3 py-1 rounded-full">
                    Completed
                  </span>
                </div>
              </div>
              <div className="bg-[#0f1419] p-4 rounded-xl border border-[#2d3748] hover:border-orange-500/30 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-white mb-1">Joined TradeScout platform</h3>
                    <p className="text-slate-400 text-sm">2 weeks ago</p>
                  </div>
                  <span className="text-blue-400 text-sm font-medium bg-blue-400/10 px-3 py-1 rounded-full">
                    Account Created
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
});

export default Profile;