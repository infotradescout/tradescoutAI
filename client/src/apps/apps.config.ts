export type AppNavPlacement = "bottom" | "right";

export interface AppConfig {
  slug: string;
  route: string;
  label: string;
  icon: string;
  nav: AppNavPlacement;
  mode?: "default" | "marketplace" | "contractors" | "admin";
  requiresAuth?: boolean;
}

const BOTTOM_NAV_PRIORITY: Record<string, number> = {
  community: 100,
  contractors: 80,
  marketplace: 70,
};

export const APPS: Record<string, AppConfig> = {
  dashboard: {
    slug: "dashboard",
    route: "/scout",
    label: "Scout Hub",
    icon: "Layout",
    nav: "right",
  },

  community: {
    slug: "community",
    route: "/community",
    label: "Local Requests",
    icon: "Users",
    nav: "bottom",
  },

  contractors: {
    slug: "contractors",
    route: "/contractors",
    label: "Businesses",
    icon: "Wrench",
    nav: "bottom",
  },

  marketplace: {
    slug: "marketplace",
    route: "/marketplace",
    label: "Marketplace",
    icon: "ShoppingCart",
    nav: "bottom",
  },

  profile: {
    slug: "profile",
    route: "/profile",
    label: "Profile & Identity",
    icon: "User",
    nav: "right",
  },

  settings: {
    slug: "settings",
    route: "/settings",
    label: "Personalization & Settings",
    icon: "SlidersHorizontal",
    nav: "right",
  },
};

export const BOTTOM_NAV_APPS = Object.values(APPS)
  .filter((app) => app.nav === "bottom")
  .sort((a, b) => {
    const ap = BOTTOM_NAV_PRIORITY[a.slug] ?? 0;
    const bp = BOTTOM_NAV_PRIORITY[b.slug] ?? 0;
    if (ap !== bp) return bp - ap;
    return a.label.localeCompare(b.label);
  });

export const RIGHT_DRAWER_APPS = Object.values(APPS).filter((app) => app.nav === "right");
