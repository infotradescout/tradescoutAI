import { type LucideIcon, Home, Wrench, Building, Car, Users, Shield, Eye, Crown, Briefcase, UtensilsCrossed, Truck, Wine, Heart, Shield as ShieldIcon, CreditCard } from "lucide-react";
import { getUserTypeMetadata } from "@shared/userTypes";

export interface RoleUiConfig {
  label?: string;
  desc?: string;
  icon?: LucideIcon;
  color?: string;
  dashboard?: string;
  userTypeId?: string;
}

// Base UI configuration for known roles. Text metadata is optionally
// overridden from shared user type metadata where available.
const BASE_ROLE_UI_CONFIG: Record<string, RoleUiConfig> = {
  homeowner: {
    userTypeId: "homeowner",
    icon: Home,
    color: "bg-blue-500",
  },
  contractor_user: {
    userTypeId: "contractor",
    icon: Wrench,
    color: "bg-orange-500",
    dashboard: "/contractor-dashboard",
  },
  realtor: {
    userTypeId: "realtor",
    icon: Building,
    color: "bg-green-500",
    dashboard: "/realtor-dashboard",
  },
  car_salesman: {
    userTypeId: "car_dealer",
    icon: Car,
    color: "bg-purple-500",
    dashboard: "/car-salesman-dashboard",
  },
  helper: {
    userTypeId: "service_provider",
    icon: Users,
    color: "bg-cyan-500",
    dashboard: "/helper-dashboard",
  },
  business_owner: {
    userTypeId: "business_owner",
    icon: Briefcase,
    color: "bg-indigo-500",
    dashboard: "/business-owner-dashboard",
  },
  restaurant_owner: {
    userTypeId: "restaurant_owner",
    icon: UtensilsCrossed,
    color: "bg-orange-500",
    dashboard: "/business-owner-dashboard",
  },
  food_truck_owner: {
    userTypeId: "food_truck_owner",
    icon: Truck,
    color: "bg-orange-500",
    dashboard: "/business-owner-dashboard",
  },
  bar_owner: {
    userTypeId: "bar_owner",
    icon: Wine,
    color: "bg-purple-600",
    dashboard: "/business-owner-dashboard",
  },
  insurance_agent: {
    userTypeId: "insurance_agent",
    icon: ShieldIcon,
    color: "bg-green-500",
  },
  mortgage_broker: {
    userTypeId: "mortgage_broker",
    icon: CreditCard,
    color: "bg-indigo-500",
  },
  property_manager: {
    userTypeId: "property_manager",
    icon: Building,
    color: "bg-teal-500",
  },
  // Vehicle dealer is a legacy role key used in onboarding.
  // Map it to the car_dealer user type for labels.
  vehicle_dealer: {
    userTypeId: "car_dealer",
    icon: Car,
    color: "bg-cyan-500",
  },
  hoa_admin: {
    userTypeId: "hoa_board",
    icon: Users,
    color: "bg-violet-500",
  },
  // Admin / staff roles
  moderator: {
    userTypeId: "admin",
    icon: Shield,
    color: "bg-yellow-500",
    dashboard: "/admin/moderation",
  },
  ops_admin: {
    userTypeId: "admin",
    icon: Eye,
    color: "bg-red-500",
    dashboard: "/admin/dashboard",
  },
  // Super Admin is the highest admin role.
  super_admin: {
    userTypeId: "admin",
    icon: Crown,
    color: "bg-gradient-to-r from-yellow-400 to-red-500",
    dashboard: "/admin",
  },
};

// Roles that can be self-managed from Settings "Manage Your Roles".
// This preserves the existing behavior while centralizing the keys.
export const SELF_SERVICE_ROLE_KEYS: string[] = [
  "homeowner",
  "contractor_user",
  "realtor",
  "car_salesman",
  "helper",
  "business_owner",
  "restaurant_owner",
  "food_truck_owner",
  "bar_owner",
  "insurance_agent",
  "mortgage_broker",
  "property_manager",
  "vehicle_dealer",
  "hoa_admin",
];

function prettifyId(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getRoleUiConfig(roleKey: string): RoleUiConfig {
  if (!roleKey) return {};
  let baseRole = roleKey.split(":")[0];
  // Backward-compat: treat head_admin as super_admin.
  if (baseRole === "head_admin") baseRole = "super_admin";
  const base = BASE_ROLE_UI_CONFIG[baseRole] || {};
  const userTypeId = base.userTypeId || baseRole;
  const meta = getUserTypeMetadata(userTypeId);

  const label = base.label || meta?.label || prettifyId(userTypeId);
  const desc = base.desc || meta?.description;

  return {
    ...base,
    label,
    desc,
  };
}

export function getRoleDashboardPath(roleKey: string): string | undefined {
  let baseRole = roleKey.split(":")[0];
  if (baseRole === "head_admin") baseRole = "super_admin";
  const base = BASE_ROLE_UI_CONFIG[baseRole];
  return base?.dashboard;
}
