import React, { useState, useCallback, memo } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { isBusinessProviderRole } from "@/lib/roleChecks";
import { ROUTES } from "@/lib/routes";
import {
  GripVertical,
  Eye,
  EyeOff,
  Home,
  Search,
  Calculator,
  ClipboardList,
  Users,
  Package,
  Trophy,
  MessageCircle,
  Heart,
  MessageSquare,
  Bell,
  User,
  UserPlus,
  Share,
  Bookmark,
  Layout,
  Wrench,
  Star,
  Zap,
  Building,
  Car,
  Briefcase,
  Shield,
  Settings,
  Crown,
  BarChart,
  Bug,
  HelpCircle,
  CreditCard,
  RotateCcw,
} from "lucide-react";

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  visible: boolean;
}

// Map icon strings to actual icon components
const getIconComponent = (iconName: string) => {
  const iconMap: { [key: string]: any } = {
    Home: Home,
    Search: Search,
    Calculator: Calculator,
    ClipboardList: ClipboardList,
    Users: Users,
    Package: Package,
    Trophy: Trophy,
    MessageCircle: MessageCircle,
    Heart: Heart,
    MessageSquare: MessageSquare,
    Bell: Bell,
    User: User,
    UserPlus: UserPlus,
    Share: Share,
    Bookmark: Bookmark,
    Layout: Layout,
    Wrench: Wrench,
    Star: Star,
    Zap: Zap,
    Building: Building,
    Car: Car,
    Briefcase: Briefcase,
    Shield: Shield,
    Settings: Settings,
    Crown: Crown,
    BarChart: BarChart,
    Bug: Bug,
    HelpCircle: HelpCircle,
    CreditCard: CreditCard,
  };

  return iconMap[iconName] || Home;
};

// Default navigation items based on user role
export function getDefaultNavigationItems(userRole: string): NavigationItem[] {
  const baseItems: NavigationItem[] = [
    // Core navigation items - available to all users
    {
      id: "direct-connect",
      label: "Direct Connect",
      icon: "ClipboardList",
      href: "/direct-connect",
      visible: true,
    },
    {
      id: "contractors",
      label: "Find Local Help",
      icon: "Search",
      href: "/direct-connect",
      visible: true,
    },
    {
      id: "scout",
      label: "Scout",
      icon: "Calculator",
      href: "/scout",
      visible: true,
    },
    {
      id: "workers",
      label: "Helpers",
      icon: "Users",
      href: "/worker-marketplace",
      visible: true,
    },
    {
      id: "marketplace",
      label: "Exchange",
      icon: "Package",
      href: "/marketplace",
      visible: true,
    },
    {
      id: "homescout",
      label: "HomeScout",
      icon: "Home",
      href: "/homescout-listings",
      visible: true,
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      icon: "Trophy",
      href: "/leaderboard",
      visible: true,
    },
    {
      id: "community",
      label: "Community",
      icon: "MessageCircle",
      href: "/community",
      visible: true,
    },
    {
      id: "foundation",
      label: "Community Builders",
      icon: "Heart",
      href: "/foundation",
      visible: true,
    },
  ];

  // Authenticated user items
  if (userRole) {
    baseItems.push(
      {
        id: "conversations",
        label: "Messages",
        icon: "MessageSquare",
        href: "/chat",
        visible: true,
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: "Bell",
        href: "/notifications",
        visible: true,
      },
      {
        id: "profile",
        label: "Profile",
        icon: "User",
        href: "/profile",
        visible: true,
      },
      {
        id: "invite",
        label: "Invite Friends",
        icon: "UserPlus",
        href: "/invite",
        visible: true,
      },
      {
        id: "affiliate",
        label: "Affiliate Program",
        icon: "Share",
        href: "/affiliate",
        visible: true,
      },
      {
        id: "saved-ads",
        label: "Saved Ads",
        icon: "Bookmark",
        href: "/saved-ads",
        visible: true,
      }
    );
  }

  // Role-specific dashboard items
  if (userRole === "homeowner") {
    baseItems.push({
      id: "homeowner-dashboard",
      label: "Dashboard",
      icon: "Layout",
      href: "/homeowner-dashboard",
      visible: true,
    });
  }

  if (isBusinessProviderRole(userRole)) {
    baseItems.push(
      {
        id: "contractor-network",
        label: "For Businesses",
        icon: "Wrench",
        href: "/claim-my-business?source=navigation_preferences",
        visible: true,
      },
      {
        id: "contractor-dashboard",
        label: "Business Dashboard",
        icon: "Layout",
        href: "/business-dashboard",
        visible: true,
      },
      {
        id: "contractor-promos",
        label: "My Promos",
        icon: "Star",
        href: "/promotions",
        visible: true,
      }
    );

    if (userRole === "accelerator_member") {
      baseItems.push({
        id: "accelerator",
        label: "Business Access",
        icon: "Zap",
        href: "/accelerator",
        visible: true,
      });
    }
  }

  if (userRole === "realtor") {
    baseItems.push(
      {
        id: "realtor-application",
        label: "Realtor Tools",
        icon: "Building",
        href: "/realtor-application",
        visible: true,
      },
      {
        id: "realtor-dashboard",
        label: "Realtor Dashboard",
        icon: "Layout",
        href: "/realtor-dashboard",
        visible: true,
      }
    );
  }

  if (userRole === "car_salesman") {
    baseItems.push(
      {
        id: "car-salesman-application",
        label: "Auto Sales",
        icon: "Car",
        href: "/car-salesman-application",
        visible: true,
      },
      {
        id: "car-salesman-dashboard",
        label: "Car Sales Dashboard",
        icon: "Layout",
        href: "/car-salesman-dashboard",
        visible: true,
      }
    );
  }

  // Professional services
  if (["realtor", "mortgage_broker", "insurance_agent", "property_manager"].includes(userRole)) {
    baseItems.push({
      id: "professional-dashboard",
      label: "Professional Dashboard",
      icon: "Briefcase",
      href: `/${userRole.replace("_", "-")}-dashboard`,
      visible: true,
    });
  }

  // Moderation access
  if (
    ["moderator", "ops_admin", "owner", "territory_manager", "contractor_success"].includes(
      userRole
    )
  ) {
    baseItems.push({
      id: "moderation",
      label: "Moderation",
      icon: "Shield",
      href: "/admin/moderation",
      visible: true,
    });
  }

  // Admin access
  if (["ops_admin", "owner"].includes(userRole)) {
    baseItems.push(
      {
        id: "admin-dashboard",
        label: "Admin Dashboard",
        icon: "Settings",
        href: ROUTES.ADMIN_DASHBOARD,
        visible: true,
      },
      {
        id: "admin-panel",
        label: "Admin Panel",
        icon: "Crown",
        href: ROUTES.ADMIN_PANEL,
        visible: true,
      },
      {
        id: "admin-users",
        label: "User Management",
        icon: "Users",
        href: "/admin/users",
        visible: true,
      },
      {
        id: "admin-workspace",
        label: "Analytics",
        icon: "BarChart",
        href: "/admin/pricing",
        visible: true,
      },
      {
        id: "admin-error-reports",
        label: "Error Reports",
        icon: "Bug",
        href: "/admin/errors",
        visible: true,
      },
      {
        id: "admin-listings",
        label: "Manage Listings",
        icon: "Package",
        href: "/admin/listings",
        visible: true,
      },
      {
        id: "admin-professional-verification",
        label: "Professional Verification",
        icon: "Shield",
        href: "/admin/professional-verification",
        visible: true,
      },
      {
        id: "admin-testing",
        label: "Testing Controls",
        icon: "Settings",
        href: "/admin/control",
        visible: true,
      }
    );
  }

  // Advanced features
  if (userRole) {
    baseItems.push(
      {
        id: "advanced-search",
        label: "Advanced Search",
        icon: "Search",
        href: "/advanced-search",
        visible: true,
      },
      {
        id: "help",
        label: "Help & Support",
        icon: "HelpCircle",
        href: "/help",
        visible: true,
      },
      {
        id: "payment-history",
        label: "Payment History",
        icon: "CreditCard",
        href: "/payment-history",
        visible: true,
      }
    );
  }

  return baseItems;
}

interface NavigationPreferencesProps {
  preferences: {
    customOrder: string[];
    enableSwipeNavigation: boolean;
    hiddenFromSwipe: string[];
  };
  userRole: string;
}

const DragDropNavigationPreferences = memo(
  ({ preferences, userRole }: NavigationPreferencesProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Initialize navigation items with user preferences
    const defaultItems = getDefaultNavigationItems(userRole);
    const [navigationItems, setNavigationItems] = useState<NavigationItem[]>(() => {
      const customOrder = preferences?.customOrder || [];
      const hiddenItems = preferences?.hiddenFromSwipe || [];

      // Apply custom order and visibility
      const orderedItems = [...defaultItems];
      if (customOrder.length > 0) {
        orderedItems.sort((a, b) => {
          const aIndex = customOrder.indexOf(a.id);
          const bIndex = customOrder.indexOf(b.id);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }

      return orderedItems.map((item) => ({
        ...item,
        visible: !hiddenItems.includes(item.id),
      }));
    });

    const [swipeEnabled, setSwipeEnabled] = useState(preferences?.enableSwipeNavigation ?? true);

    // Update navigation preferences mutation
    const updateNavigationMutation = useMutation({
      mutationFn: async (newPreferences: any) => {
        return apiRequest("PUT", "/api/user/navigation-preferences", newPreferences);
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
          description: formatUserFacingErrorMessage(
            error,
            "Failed to update navigation preferences."
          ),
          variant: "destructive",
        });
      },
    });

    // Handle drag end
    const handleDragEnd = useCallback(
      (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(navigationItems);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setNavigationItems(items);

        // Update backend with new order
        const customOrder = items.map((item) => item.id);
        const hiddenFromSwipe = items.filter((item) => !item.visible).map((item) => item.id);

        updateNavigationMutation.mutate({
          customOrder,
          enableSwipeNavigation: swipeEnabled,
          hiddenFromSwipe,
        });
      },
      [navigationItems, swipeEnabled, updateNavigationMutation]
    );

    // Handle visibility toggle
    const toggleItemVisibility = useCallback(
      (itemId: string) => {
        const updatedItems = navigationItems.map((item) =>
          item.id === itemId ? { ...item, visible: !item.visible } : item
        );
        setNavigationItems(updatedItems);

        // Update backend
        const customOrder = updatedItems.map((item) => item.id);
        const hiddenFromSwipe = updatedItems.filter((item) => !item.visible).map((item) => item.id);

        updateNavigationMutation.mutate({
          customOrder,
          enableSwipeNavigation: swipeEnabled,
          hiddenFromSwipe,
        });
      },
      [navigationItems, swipeEnabled, updateNavigationMutation]
    );

    // Handle swipe toggle
    const toggleSwipeNavigation = useCallback(() => {
      const newSwipeEnabled = !swipeEnabled;
      setSwipeEnabled(newSwipeEnabled);

      const customOrder = navigationItems.map((item) => item.id);
      const hiddenFromSwipe = navigationItems
        .filter((item) => !item.visible)
        .map((item) => item.id);

      updateNavigationMutation.mutate({
        customOrder,
        enableSwipeNavigation: newSwipeEnabled,
        hiddenFromSwipe,
      });
    }, [swipeEnabled, navigationItems, updateNavigationMutation]);

    // Reset to defaults
    const resetToDefaults = useCallback(() => {
      const defaultItems = getDefaultNavigationItems(userRole);
      setNavigationItems(defaultItems);
      setSwipeEnabled(true);

      updateNavigationMutation.mutate({
        customOrder: [],
        enableSwipeNavigation: true,
        hiddenFromSwipe: [],
      });
    }, [userRole, updateNavigationMutation]);

    return (
      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <GripVertical className="h-5 w-5" />
            Navigation Preferences
          </CardTitle>
          <CardDescription className="text-white/60">
            Customize your navigation menu order and visibility. Drag items to reorder them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Swipe Navigation Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="swipe-navigation">Enable Swipe Navigation</Label>
              <p className="text-sm text-muted-foreground">
                Allow swiping between navigation sections on mobile
              </p>
            </div>
            <Switch
              id="swipe-navigation"
              data-testid="nav-prefs-swipe-toggle"
              checked={swipeEnabled}
              onCheckedChange={toggleSwipeNavigation}
            />
          </div>

          <Separator className="bg-tsCard" />

          {/* Navigation Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">Navigation Items</h4>
              <Button
                variant="outline"
                size="sm"
                data-testid="nav-prefs-reset"
                onClick={resetToDefaults}
                className="h-8 bg-tsCard border-white/10 text-white hover:bg-tsCard"
                disabled={updateNavigationMutation.isPending}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="navigation-items">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`space-y-2 p-2 rounded-lg transition-colors ${
                      snapshot.isDraggingOver ? "bg-tsCard/50" : ""
                    }`}
                  >
                    {navigationItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            data-testid={`nav-prefs-item-${item.id}`}
                            className={`flex items-center justify-between p-3 bg-tsCard border border-white/10 rounded-lg transition-all ${
                              snapshot.isDragging
                                ? "shadow-lg border-ts-orange/30 bg-tsCard"
                                : "hover:bg-tsCard"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white transition-colors"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-white/60">
                                  {React.createElement(getIconComponent(item.icon), {
                                    className: "h-4 w-4",
                                  })}
                                </div>
                                <div className="text-white/70">{item.label}</div>
                                <div className="text-xs text-white/60 font-mono">{item.href}</div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleItemVisibility(item.id)}
                              className="text-white/60 hover:text-white p-1"
                              data-tutorial="visibility-toggle"
                              data-testid={`nav-prefs-visibility-${item.id}`}
                            >
                              {item.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <p className="text-xs text-white/60">
              {swipeEnabled ? "✓" : "✗"} Swipe navigation is {swipeEnabled ? "enabled" : "disabled"}
              . Visible items: {navigationItems.filter((item) => item.visible).length}/
              {navigationItems.length}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
);

DragDropNavigationPreferences.displayName = "DragDropNavigationPreferences";

export default DragDropNavigationPreferences;
