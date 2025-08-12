import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Calendar, 
  Shield, 
  Edit2, 
  Save, 
  X,
  Camera,
  Key,
  Bell,
  Settings,
  Navigation,
  GripVertical,
  Eye,
  EyeOff,
  Home,
  Users,
  MessageSquare,
  BarChart3,
  Briefcase,
  Wrench
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  // Contractor-specific fields
  companyName: z.string().optional(),
  businessDescription: z.string().optional(),
  licenseNumber: z.string().optional(),
  yearsInBusiness: z.number().optional(),
  isGeneralContractor: z.boolean().optional(),
  isResidentialContractor: z.boolean().optional(),
  acceptsSubcontractWork: z.boolean().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  marketingEmails: z.boolean(),
  weeklyDigest: z.boolean(),
  instantMessages: z.boolean(),
  leadNotifications: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type NotificationFormData = z.infer<typeof notificationSchema>;

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      city: user?.city || "",
      state: user?.state || "",
      zipCode: user?.zipCode || "",
      companyName: user?.companyName || "",
      businessDescription: user?.businessDescription || "",
      licenseNumber: user?.licenseNumber || "",
      yearsInBusiness: user?.yearsInBusiness || 0,
      isGeneralContractor: user?.isGeneralContractor || false,
      isResidentialContractor: user?.isResidentialContractor || false,
      acceptsSubcontractWork: user?.acceptsSubcontractWork || false,
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Notification preferences form
  const notificationForm = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: true,
      marketingEmails: false,
      weeklyDigest: true,
      instantMessages: true,
      leadNotifications: true,
    },
  });

  // Navigation preferences state
  const [navigationItems, setNavigationItems] = useState([
    { id: "home", label: "Home", icon: Home },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "contractors", label: "Contractors", icon: Users },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "marketplace", label: "Marketplace", icon: Briefcase },
    { id: "leaderboard", label: "Leaderboard", icon: Building },
    { id: "growth-pack", label: "Growth Pack", icon: Wrench }
  ]);

  // Fetch navigation preferences
  const { data: navigationPrefs } = useQuery({
    queryKey: ["/api/user/navigation-preferences"],
    enabled: !!user,
  });

  // Update local state when navigation preferences are fetched
  useEffect(() => {
    if (navigationPrefs) {
      if (navigationPrefs.customOrder && navigationPrefs.customOrder.length > 0) {
        const orderedItems = navigationPrefs.customOrder.map((id: string) => 
          navigationItems.find(item => item.id === id)
        ).filter(Boolean);
        // Add any items not in custom order at the end
        const remainingItems = navigationItems.filter(item => 
          !navigationPrefs.customOrder.includes(item.id)
        );
        setNavigationItems([...orderedItems, ...remainingItems]);
      }
    }
  }, [navigationPrefs]);

  // Navigation preferences mutation
  const updateNavigationMutation = useMutation({
    mutationFn: async (preferences: any) => {
      return apiRequest("PUT", "/api/user/navigation-preferences", preferences);
    },
    onSuccess: () => {
      toast({
        title: "Navigation Updated",
        description: "Your navigation preferences have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/navigation-preferences"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update navigation preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle drag and drop for navigation items
  const handleOnDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(navigationItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setNavigationItems(items);

    // Update navigation preferences
    const customOrder = items.map(item => item.id);
    updateNavigationMutation.mutate({
      customOrder,
      enableSwipeNavigation: navigationPrefs?.enableSwipeNavigation !== false,
      hiddenFromSwipe: navigationPrefs?.hiddenFromSwipe || []
    });
  };

  // Handle toggling swipe navigation for individual items
  const toggleSwipeVisibility = (itemId: string) => {
    const currentHidden = navigationPrefs?.hiddenFromSwipe || [];
    const newHidden = currentHidden.includes(itemId) 
      ? currentHidden.filter((id: string) => id !== itemId)
      : [...currentHidden, itemId];

    updateNavigationMutation.mutate({
      customOrder: navigationPrefs?.customOrder || navigationItems.map(item => item.id),
      enableSwipeNavigation: navigationPrefs?.enableSwipeNavigation !== false,
      hiddenFromSwipe: newHidden
    });
  };

  // Handle toggling swipe navigation globally
  const toggleSwipeNavigation = () => {
    updateNavigationMutation.mutate({
      customOrder: navigationPrefs?.customOrder || navigationItems.map(item => item.id),
      enableSwipeNavigation: !navigationPrefs?.enableSwipeNavigation,
      hiddenFromSwipe: navigationPrefs?.hiddenFromSwipe || []
    });
  };

  // Fetch user profile details
  const { data: profileData } = useQuery({
    queryKey: ["/api/auth/profile"],
    enabled: !!user,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PUT", "/api/auth/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
      setEditMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      return apiRequest("PUT", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update notification preferences mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: NotificationFormData) => {
      return apiRequest("PUT", "/api/auth/notifications", data);
    },
    onSuccess: () => {
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  const onNotificationSubmit = (data: NotificationFormData) => {
    updateNotificationsMutation.mutate(data);
  };

  const handleCancel = () => {
    profileForm.reset();
    setEditMode(false);
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap = {
      homeowner: "Homeowner",
      contractor_user: "Contractor",
      accelerator_member: "Accelerator Member",
      moderator: "Moderator",
      ops_admin: "Operations Admin",
      head_admin: "Head Admin",
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    const variantMap = {
      homeowner: "default",
      contractor_user: "secondary",
      accelerator_member: "outline",
      moderator: "destructive",
      ops_admin: "default",
      head_admin: "destructive",
    };
    return variantMap[role as keyof typeof variantMap] || "default";
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 to-slate-900 flex items-center justify-center">
        <Card className="w-96 bg-navy-800 border-navy-600">
          <CardContent className="p-6 text-center">
            <p className="text-white">Please log in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <Card className="mb-6 bg-navy-800 border-navy-600">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.profileImageUrl} alt={`${user.firstName} ${user.lastName}`} />
                  <AvatarFallback className="bg-orange-500 text-white text-xl">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <Button 
                  size="sm" 
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{user.firstName} {user.lastName}</h1>
                <p className="text-gray-400">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={getRoleBadgeVariant(user.role) as any}>
                    {getRoleDisplayName(user.role)}
                  </Badge>
                  {user.isVerified && (
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                {!editMode ? (
                  <Button 
                    onClick={() => setEditMode(true)}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleCancel}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      onClick={profileForm.handleSubmit(onProfileSubmit)}
                      disabled={updateProfileMutation.isPending}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-navy-700 mb-6">
            <TabsTrigger value="profile" className="data-[state=active]:bg-orange-500">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-orange-500">
              <Key className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-orange-500">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-orange-500">
              <Settings className="h-4 w-4 mr-2" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* Profile Information Tab */}
          <TabsContent value="profile">
            <Card className="bg-navy-800 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    {/* Basic Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">First Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Last Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Email</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Phone</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator className="bg-navy-600" />

                    {/* Address Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">Address Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="text-gray-300">Street Address</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">City</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">State</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">ZIP Code</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!editMode}
                                  className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Contractor-specific fields */}
                    {user.role === 'contractor_user' && (
                      <>
                        <Separator className="bg-navy-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-4">Business Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={profileForm.control}
                              name="companyName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-300">Company Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      disabled={!editMode}
                                      className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={profileForm.control}
                              name="licenseNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-300">License Number</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      disabled={!editMode}
                                      className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={profileForm.control}
                              name="yearsInBusiness"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-gray-300">Years in Business</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      disabled={!editMode}
                                      className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={profileForm.control}
                            name="businessDescription"
                            render={({ field }) => (
                              <FormItem className="mt-4">
                                <FormLabel className="text-gray-300">Business Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    disabled={!editMode}
                                    className="bg-navy-700 border-navy-600 text-white disabled:opacity-70"
                                    rows={3}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <FormField
                              control={profileForm.control}
                              name="isGeneralContractor"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-sm text-gray-300">General Contractor</FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      disabled={!editMode}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={profileForm.control}
                              name="isResidentialContractor"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-sm text-gray-300">Residential Contractor</FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      disabled={!editMode}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={profileForm.control}
                              name="acceptsSubcontractWork"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-sm text-gray-300">Accepts Subcontract Work</FormLabel>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      disabled={!editMode}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="bg-navy-800 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Security Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Current Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="bg-navy-700 border-navy-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">New Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="bg-navy-700 border-navy-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-300">Confirm New Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="bg-navy-700 border-navy-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      disabled={changePasswordMutation.isPending}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {changePasswordMutation.isPending ? "Updating..." : "Change Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="bg-navy-800 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...notificationForm}>
                  <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <FormField
                        control={notificationForm.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base text-white">Email Notifications</FormLabel>
                              <FormDescription className="text-gray-400">
                                Receive notifications via email
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="pushNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base text-white">Push Notifications</FormLabel>
                              <FormDescription className="text-gray-400">
                                Receive push notifications in your browser
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="marketingEmails"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base text-white">Marketing Emails</FormLabel>
                              <FormDescription className="text-gray-400">
                                Receive marketing and promotional emails
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="weeklyDigest"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base text-white">Weekly Digest</FormLabel>
                              <FormDescription className="text-gray-400">
                                Receive a weekly summary of platform activity
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="instantMessages"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base text-white">Instant Messages</FormLabel>
                              <FormDescription className="text-gray-400">
                                Receive notifications for new messages
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {user.role === 'contractor_user' && (
                        <FormField
                          control={notificationForm.control}
                          name="leadNotifications"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-navy-600 p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base text-white">Lead Notifications</FormLabel>
                                <FormDescription className="text-gray-400">
                                  Receive notifications for new leads and opportunities
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      disabled={updateNotificationsMutation.isPending}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {updateNotificationsMutation.isPending ? "Saving..." : "Save Preferences"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="bg-navy-800 border-navy-600">
              <CardHeader>
                <CardTitle className="text-white">Account Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
                    <div className="space-y-4 text-gray-300">
                      <div className="flex justify-between">
                        <span>Account Created:</span>
                        <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Login:</span>
                        <span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Account Status:</span>
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-navy-600" />

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Privacy Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-base text-white">Profile Visibility</label>
                          <p className="text-sm text-gray-400">Control who can see your profile</p>
                        </div>
                        <Select defaultValue="public">
                          <SelectTrigger className="w-[180px] bg-navy-700 border-navy-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-navy-700 border-navy-600">
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="restricted">Restricted</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-base text-white">Contact Information</label>
                          <p className="text-sm text-gray-400">Allow others to see your contact details</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-navy-600" />

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Navigation Preferences</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-base text-white">Enable Swipe Navigation</label>
                          <p className="text-sm text-gray-400">Allow swiping between pages on mobile and tablets</p>
                        </div>
                        <Switch 
                          checked={navigationPrefs?.enableSwipeNavigation !== false}
                          onCheckedChange={toggleSwipeNavigation}
                          disabled={updateNavigationMutation.isPending}
                        />
                      </div>

                      <div>
                        <label className="text-base text-white mb-4 block">Customize Navigation Order</label>
                        <p className="text-sm text-gray-400 mb-4">Drag and drop to reorder navigation items. Use the eye icon to hide items from swipe navigation.</p>
                        
                        <DragDropContext onDragEnd={handleOnDragEnd}>
                          <Droppable droppableId="navigation-items">
                            {(provided) => (
                              <div 
                                {...provided.droppableProps} 
                                ref={provided.innerRef}
                                className="space-y-2"
                              >
                                {navigationItems.map((item, index) => {
                                  const Icon = item.icon;
                                  const isHidden = navigationPrefs?.hiddenFromSwipe?.includes(item.id);
                                  
                                  return (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`flex items-center justify-between p-3 bg-navy-700 border border-navy-600 rounded-lg ${
                                            snapshot.isDragging ? 'shadow-lg bg-navy-600' : ''
                                          }`}
                                        >
                                          <div className="flex items-center space-x-3">
                                            <div 
                                              {...provided.dragHandleProps}
                                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white"
                                            >
                                              <GripVertical className="h-4 w-4" />
                                            </div>
                                            <Icon className="h-4 w-4 text-orange-500" />
                                            <span className="text-white">{item.label}</span>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-400">
                                              {isHidden ? 'Hidden from swipe' : 'Visible in swipe'}
                                            </span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => toggleSwipeVisibility(item.id)}
                                              disabled={updateNavigationMutation.isPending}
                                              className="h-8 w-8 p-0 hover:bg-navy-600"
                                            >
                                              {isHidden ? (
                                                <EyeOff className="h-4 w-4 text-gray-400" />
                                              ) : (
                                                <Eye className="h-4 w-4 text-green-500" />
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>

                        {updateNavigationMutation.isPending && (
                          <p className="text-sm text-orange-500 mt-2">Saving navigation preferences...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-navy-600" />

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Danger Zone</h3>
                    <div className="space-y-4">
                      <Button variant="destructive" className="w-full">
                        Delete Account
                      </Button>
                      <p className="text-sm text-gray-400">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}